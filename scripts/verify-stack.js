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

function flattenLoki(body) {
  return (body.data?.result || []).flatMap(stream =>
    (stream.values || []).map(value => ({
      timestamp: value[0],
      line: value[1],
      metadata: { ...(stream.stream || {}), ...(value[2] || {}) },
    }))
  );
}

const loki = {};
const nowNs = BigInt(Date.now()) * 1000000n;
const startNs = nowNs - 15n * 60n * 1000000000n;
const endNs = nowNs + 60n * 1000000000n;
const broadParams = new URLSearchParams({
  query: '{service_name=~".+"}',
  limit: '200',
  start: startNs.toString(),
  end: endNs.toString(),
  direction: 'backward',
});

for (const c of cases) {
  const expectedBody = c.scenario === 'error' ? 'checkout.failed' : 'checkout.completed';
  const result = await poll(`Loki correlated log ${c.scenario}`, async () => {
    const body = await json(`http://127.0.0.1:3100/loki/api/v1/query_range?${broadParams}`);
    const entries = flattenLoki(body);
    const match = entries.find(entry =>
      entry.line === expectedBody &&
      entry.metadata.trace_id === c.trace_id &&
      entry.metadata.service_name === 'synthetic-checkout'
    );
    if (!match) return null;
    return {
      trace_id: c.trace_id,
      service_name: match.metadata.service_name,
      test_run_id: match.metadata.test_run_id,
      log_body: match.line,
    };
  });
  assert.equal(result.test_run_id, c.test_run_id, `Loki lost test_run_id for ${c.scenario}`);
  loki[c.scenario] = result;
}

const prometheus = await poll('Prometheus metrics', async () => {
  const candidates = [
    'lab_http_requests_total',
    '{__name__=~"lab_http_requests.*"}',
  ];
  for (const query of candidates) {
    const body = await json(`http://127.0.0.1:9090/api/v1/query?query=${encodeURIComponent(query)}`);
    const result = body.data?.result || [];
    if (!result.length) continue;
    const names = [...new Set(result.map(item => item.metric?.__name__).filter(Boolean))];
    if (names.some(name => name.includes('lab_http_requests'))) return { query, names };
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
  statement: 'OTLP telemetry from the synthetic checkout was ingested by the local LGTM stack and is queryable from Grafana, Tempo, Loki and Prometheus.',
};
writeFileSync(`${directory}/stack-verification.json`, JSON.stringify(verification, null, 2));
console.log(verification);
