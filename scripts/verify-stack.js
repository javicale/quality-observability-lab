import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const latest = JSON.parse(readFileSync('artifacts/latest.json', 'utf8'));
assert.equal(latest.telemetry_mode, 'file+otlp', 'Stack verification requires OTLP mode');
const directory = latest.evidence_directory;
const cases = ['success', 'error'].map(name => JSON.parse(readFileSync(`${directory}/${name}.json`, 'utf8')));

async function poll(name, fn, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`${name} verification timed out: ${lastError?.message || 'signal not found'}`);
}

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

const grafanaHealth = await json('http://127.0.0.1:3001/api/health');
assert.ok(grafanaHealth.database === 'ok' || grafanaHealth.database === undefined, 'Grafana database unhealthy');
const dashboards = await poll('Grafana dashboard', async () => {
  const result = await json('http://127.0.0.1:3001/api/search?query=Quality%20Observability%20Lab');
  return result.some(item => item.title === 'Quality Observability Lab') ? result : null;
});

const tempo = {};
for (const c of cases) {
  await poll(`Tempo trace ${c.scenario}`, async () => {
    const response = await fetch(`http://127.0.0.1:3200/api/traces/${c.trace_id}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Tempo returned HTTP ${response.status}`);
    const body = await response.json();
    return body?.batches?.length ? body : null;
  });
  tempo[c.scenario] = c.trace_id;
}

const loki = {};
for (const c of cases) {
  const query = `{service_name="synthetic-checkout"} | trace_id = "${c.trace_id}"`;
  const nowNs = BigInt(Date.now()) * 1000000n;
  const startNs = nowNs - 15n * 60n * 1000000000n;
  const endNs = nowNs + 60n * 1000000000n;
  const params = new URLSearchParams({ query, limit: '50', start: startNs.toString(), end: endNs.toString() });
  const result = await poll(`Loki log ${c.scenario}`, async () => {
    const body = await json(`http://127.0.0.1:3100/loki/api/v1/query_range?${params}`);
    const count = (body.data?.result || []).reduce((sum, stream) => sum + (stream.values?.length || 0), 0);
    return count > 0 ? { count } : null;
  });
  loki[c.scenario] = { trace_id: c.trace_id, entries: result.count };
}

const prometheus = await poll('Prometheus metrics', async () => {
  const queries = ['{service_name="synthetic-checkout"}', 'lab_http_requests_total'];
  for (const query of queries) {
    const body = await json(`http://127.0.0.1:9090/api/v1/query?query=${encodeURIComponent(query)}`);
    const result = body.data?.result || [];
    if (result.length) {
      const names = [...new Set(result.map(item => item.metric?.__name__).filter(Boolean))];
      if (names.some(name => name.includes('lab_http_requests'))) return { query, names };
    }
  }
  return null;
});

const verification = {
  schema_version: 1,
  stack: 'PASS',
  run_id: latest.run_id,
  grafana: { status: 'PASS', dashboard: 'Quality Observability Lab', search_results: dashboards.length },
  tempo: { status: 'PASS', traces: tempo },
  loki: { status: 'PASS', logs: loki },
  prometheus: { status: 'PASS', metric_names: prometheus.names },
  statement: 'OTLP telemetry from the synthetic checkout was ingested by the local LGTM stack and is queryable from its backends.',
};
writeFileSync(`${directory}/stack-verification.json`, JSON.stringify(verification, null, 2));
console.log(verification);
