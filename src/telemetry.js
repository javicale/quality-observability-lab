import { mkdirSync, appendFileSync } from 'node:fs';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

const directory = process.env.EVIDENCE_DIR || 'artifacts/manual';
mkdirSync(directory, { recursive: true });
const write = (signal, record) => appendFileSync(`${directory}/${signal}.jsonl`, JSON.stringify(record) + '\n');
const resource = resourceFromAttributes({
  'service.name': 'synthetic-checkout',
  'service.version': '0.2.0',
  'deployment.environment.name': 'quality-observability-lab',
});

const fileExporter = (signal, map) => ({
  export(items, callback) {
    try {
      for (const item of items) write(signal, map(item));
      callback({ code: 0 });
    } catch (error) {
      callback({ code: 1, error });
    }
  },
  shutdown: async () => {},
  forceFlush: async () => {},
});

const otlpEnabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

const spanProcessors = [
  new SimpleSpanProcessor(fileExporter('traces', span => ({
    name: span.name,
    ...span.spanContext(),
    parentSpanId: span.parentSpanContext?.spanId,
    attributes: span.attributes,
    status: span.status,
    duration: span.duration,
    events: span.events,
  }))),
];
if (otlpEnabled) spanProcessors.push(new SimpleSpanProcessor(new OTLPTraceExporter()));

const traces = new NodeTracerProvider({ resource, spanProcessors });
traces.register();

const metricFileExporter = {
  export(data, callback) {
    try {
      for (const scope of data.scopeMetrics) {
        for (const metric of scope.metrics) {
          write('metrics', { name: metric.descriptor.name, dataPoints: metric.dataPoints });
        }
      }
      callback({ code: 0 });
    } catch (error) {
      callback({ code: 1, error });
    }
  },
  shutdown: async () => {},
  forceFlush: async () => {},
};

const metricReaders = [
  new PeriodicExportingMetricReader({ exporter: metricFileExporter, exportIntervalMillis: 60000 }),
];
if (otlpEnabled) {
  metricReaders.push(new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 1000,
  }));
}
const meters = new MeterProvider({ resource, readers: metricReaders });

const logProcessors = [
  new SimpleLogRecordProcessor({
    exporter: fileExporter('logs', record => ({
      body: record.body,
      severityNumber: record.severityNumber,
      attributes: record.attributes,
      ...record.spanContext,
    })),
  }),
];
if (otlpEnabled) {
  logProcessors.push(new SimpleLogRecordProcessor({ exporter: new OTLPLogExporter() }));
}
const logs = new LoggerProvider({ resource, processors: logProcessors });

export const tracer = traces.getTracer('quality-lab');
export const logger = logs.getLogger('quality-lab');
const meter = meters.getMeter('quality-lab');
export const requests = meter.createCounter('lab.http.requests');
export const duration = meter.createHistogram('lab.http.duration', { unit: 'ms' });
export const telemetryMode = otlpEnabled ? 'file+otlp' : 'file';

export async function flush() {
  await Promise.all([traces.forceFlush(), meters.forceFlush(), logs.forceFlush()]);
}

export async function shutdown() {
  await Promise.all([traces.shutdown(), meters.shutdown(), logs.shutdown()]);
}
