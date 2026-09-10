import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateEvidence({ cases, traces, logs, metrics }) {
  assert.equal(cases.length, 2, 'Exactly two scenarios required');
  assert.equal(new Set(cases.map(c => c.test_run_id)).size, 2, 'Unique scenario run IDs required');
  for (const scenario of ['success', 'error']) {
    const c = cases.find(c => c.scenario === scenario);
    assert.ok(c, `Missing ${scenario}`);
    const status = scenario === 'error' ? 500 : 200;
    assert.equal(c.schema_version, 1);
    assert.equal(c.actual_status, status);
    assert.equal(c.outcome, status === 200 ? 'PASS' : 'FAIL');
    assert.equal(c.injected_failure, scenario === 'error');
    assert.equal(c.body.test_run_id, c.test_run_id);
    assert.equal(c.body.trace_id, c.trace_id);
    assert.match(c.trace_id, /^[a-f0-9]{32}$/);
    const span = traces.find(s => s.name === 'POST /api/checkout' && s.traceId === c.trace_id && s.attributes['test.run_id'] === c.test_run_id);
    assert.ok(span, `Missing correlated server span for ${scenario}`);
    assert.equal(span.parentSpanId, c.parent_span_id, 'W3C parent lost');
    assert.equal(span.attributes['http.response.status_code'], status);
    assert.equal(span.status.code, status === 500 ? 2 : 0);
    const child = traces.find(s => s.name === 'inventory.reserve' && s.traceId === span.traceId && s.parentSpanId === span.spanId);
    assert.ok(child, 'Missing child span');
    if (status === 500) { assert.equal(child.status.code, 2); assert.ok(child.events.some(e => e.name === 'exception')); }
    assert.ok(logs.some(l => l.traceId === span.traceId && l.spanId === span.spanId && l.attributes['test.run_id'] === c.test_run_id && l.attributes['http.response.status_code'] === status && l.body === (status === 500 ? 'checkout.failed' : 'checkout.completed')), 'Missing correlated log');
    for (const name of ['lab.http.requests', 'lab.http.duration']) {
      const points = metrics.filter(m => m.name === name).flatMap(m => m.dataPoints);
      assert.ok(points.some(p => p.attributes['lab.scenario'] === scenario && p.attributes['http.response.status_code'] === status && (name.endsWith('requests') ? p.value >= 1 : p.value.count >= 1 && p.value.sum >= 0)), `Missing ${name}`);
      assert.ok(points.every(p => !('test.run_id' in p.attributes)), 'High-cardinality metric label');
    }
  }
  return { schema_version: 1, gate: 'PASS', healthy_checkout: 'PASS', injected_checkout: 'FAIL', failure_detection: 'PASS', correlation: 'PASS', scope: 'Synthetic R&D experiment; not a release approval' };
}
export function readEvidence(directory) {
  const jsonl = name => readFileSync(`${directory}/${name}.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
  return { cases: ['success', 'error'].map(s => JSON.parse(readFileSync(`${directory}/${s}.json`, 'utf8'))), traces: jsonl('traces'), logs: jsonl('logs'), metrics: jsonl('metrics') };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.argv[2];
  try { const result = validateEvidence(readEvidence(directory)); writeFileSync(`${directory}/quality-gate.json`, JSON.stringify(result, null, 2)); console.log(result); }
  catch (error) { console.error('Quality gate FAIL:', error.message); process.exitCode = 1; }
}
