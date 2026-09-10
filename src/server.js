import http from 'node:http';
import { readFileSync } from 'node:fs';
import { context, propagation, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { tracer, logger, requests, duration, flush, shutdown } from './telemetry.js';

const html = readFileSync(new URL('./index.html', import.meta.url));
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.end('ok'); return; }
  if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
  if (url.pathname !== '/api/checkout') { res.writeHead(404).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; }
  const runId = req.headers['x-test-run-id'];
  if (typeof runId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(runId)) { res.writeHead(400).end('Valid x-test-run-id required'); return; }
  const scenario = url.searchParams.get('scenario') === 'error' ? 'error' : 'success';
  const parent = propagation.extract(context.active(), req.headers);
  await tracer.startActiveSpan('POST /api/checkout', { kind: SpanKind.SERVER, attributes: { 'test.run_id': runId, 'http.request.method': req.method, 'http.route': '/api/checkout', 'lab.scenario': scenario } }, parent, async span => {
    const start = performance.now();
    const status = scenario === 'error' ? 500 : 200;
    await tracer.startActiveSpan('inventory.reserve', async child => {
      child.setAttribute('test.run_id', runId);
      if (status === 500) { child.recordException(new Error('Synthetic inventory failure')); child.setStatus({ code: SpanStatusCode.ERROR, message: 'Injected failure' }); }
      child.end();
    });
    span.setAttribute('http.response.status_code', status);
    if (status === 500) span.setStatus({ code: SpanStatusCode.ERROR, message: 'Synthetic inventory failure' });
    logger.emit({ severityNumber: status === 500 ? 17 : 9, body: status === 500 ? 'checkout.failed' : 'checkout.completed', attributes: { 'test.run_id': runId, 'http.response.status_code': status, 'lab.scenario': scenario } });
    const elapsed = performance.now() - start;
    // Run IDs deliberately stay out of metric labels to avoid unbounded cardinality.
    const labels = { 'http.route': '/api/checkout', 'http.response.status_code': status, 'lab.scenario': scenario };
    requests.add(1, labels); duration.record(elapsed, labels);
    const traceId = span.spanContext().traceId;
    span.end();
    await flush();
    res.writeHead(status, { 'Content-Type': 'application/json', 'x-trace-id': traceId, 'x-test-run-id': runId });
    res.end(JSON.stringify({ status: status === 200 ? 'confirmed' : 'failed', test_run_id: runId, trace_id: traceId, message: status === 500 ? 'Synthetic inventory failure' : 'Synthetic order confirmed' }));
  });
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Lab listening on http://127.0.0.1:3000'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await shutdown(); process.exit(0); }));
