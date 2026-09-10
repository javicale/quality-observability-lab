import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEvidence } from '../../scripts/gate.js';

function fixture() {
  const data = { cases: [], traces: [], logs: [], metrics: [] };
  for (const [index, scenario] of ['success', 'error'].entries()) {
    const status = index ? 500 : 200, traceId = String(index + 1).repeat(32), spanId = String(index + 3).repeat(16), runId = `run-${scenario}`, parent = 'a'.repeat(16);
    data.cases.push({ schema_version: 1, scenario, test_run_id: runId, trace_id: traceId, parent_span_id: parent, actual_status: status, outcome: index ? 'FAIL' : 'PASS', injected_failure: Boolean(index), body: { test_run_id: runId, trace_id: traceId } });
    data.traces.push({ name: 'POST /api/checkout', traceId, spanId, parentSpanId: parent, attributes: { 'test.run_id': runId, 'http.response.status_code': status }, status: { code: index ? 2 : 0 } }, { name: 'inventory.reserve', traceId, parentSpanId: spanId, status: { code: index ? 2 : 0 }, events: index ? [{ name: 'exception' }] : [] });
    data.logs.push({ traceId, spanId, body: index ? 'checkout.failed' : 'checkout.completed', attributes: { 'test.run_id': runId, 'http.response.status_code': status } });
    for (const name of ['lab.http.requests', 'lab.http.duration']) data.metrics.push({ name, dataPoints: [{ attributes: { 'lab.scenario': scenario, 'http.response.status_code': status }, value: name.endsWith('requests') ? 1 : { count: 1, sum: 1 } }] });
  }
  return data;
}
test('accepts complete PASS plus deliberate FAIL evidence', () => assert.equal(validateEvidence(fixture()).gate, 'PASS'));
for (const [name, mutate] of Object.entries({
  'missing failure': d => d.cases.pop(),
  'uncorrelated trace': d => d.traces[0].traceId = '0'.repeat(32),
  'broken parent': d => d.traces[0].parentSpanId = 'broken',
  'missing child': d => d.traces.splice(1, 1),
  'missing log': d => d.logs.pop(),
  'wrong log span': d => d.logs[0].spanId = 'wrong',
  'missing metrics': d => d.metrics = [],
  'unexpected healthy error': d => d.cases[0].actual_status = 500,
  'failure no longer injected': d => d.cases[1].actual_status = 200,
  'duplicate run': d => d.cases[1].test_run_id = d.cases[0].test_run_id,
  'missing exception': d => d.traces[3].events = [],
  'high cardinality': d => d.metrics[0].dataPoints[0].attributes['test.run_id'] = 'bad',
})) test(`rejects ${name}`, () => { const d = fixture(); mutate(d); assert.throws(() => validateEvidence(d)); });
