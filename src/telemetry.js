import { mkdirSync, appendFileSync } from 'node:fs';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';

const directory = process.env.EVIDENCE_DIR || 'artifacts/manual';
mkdirSync(directory, { recursive: true });
const write = (signal, record) => appendFileSync(`${directory}/${signal}.jsonl`, JSON.stringify(record) + '\n');
const resource = resourceFromAttributes({ 'service.name': 'synthetic-checkout', 'service.version': '0.1.0' });
const exporter = (signal, map) => ({
  export(items, callback) { try { for (const item of items) write(signal, map(item)); callback({ code: 0 }); } catch (error) { callback({ code: 1, error }); } },
  shutdown: async () => {}, forceFlush: async () => {},
});
const traces = new NodeTracerProvider({ resource, spanProcessors: [new SimpleSpanProcessor(exporter('traces', s => ({ name: s.name, ...s.spanContext(), parentSpanId: s.parentSpanContext?.spanId, attributes: s.attributes, status: s.status, duration: s.duration, events: s.events })))] });
traces.register();
const metricExporter = { export(data, callback) { try { for (const scope of data.scopeMetrics) for (const metric of scope.metrics) write('metrics', { name: metric.descriptor.name, dataPoints: metric.dataPoints }); callback({ code: 0 }); } catch (error) { callback({ code: 1, error }); } }, shutdown: async () => {}, forceFlush: async () => {} };
const meters = new MeterProvider({ resource, readers: [new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 60000 })] });
const logs = new LoggerProvider({ resource, processors: [new SimpleLogRecordProcessor({ exporter: exporter('logs', l => ({ body: l.body, severityNumber: l.severityNumber, attributes: l.attributes, ...l.spanContext })) })] });
export const tracer = traces.getTracer('quality-lab');
export const logger = logs.getLogger('quality-lab');
const meter = meters.getMeter('quality-lab');
export const requests = meter.createCounter('lab.http.requests');
export const duration = meter.createHistogram('lab.http.duration', { unit: 'ms' });
export async function flush() { await Promise.all([traces.forceFlush(), meters.forceFlush(), logs.forceFlush()]); }
export async function shutdown() { await Promise.all([traces.shutdown(), meters.shutdown(), logs.shutdown()]); }
