import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const id = randomUUID();
const directory = resolve('artifacts', id);
mkdirSync(directory, { recursive: true });
const env = { ...process.env, LAB_RUN_ID: id, EVIDENCE_DIR: directory };
const useOtlp = process.argv.includes('--otel');
if (process.argv.includes('--raw-failure')) env.LAB_RAW_FAILURE = '1';
if (useOtlp) {
  env.OTEL_EXPORTER_OTLP_ENDPOINT = env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://127.0.0.1:4318';
  env.OTEL_EXPORTER_OTLP_PROTOCOL = env.OTEL_EXPORTER_OTLP_PROTOCOL || 'http/json';
}

const run = args => spawnSync(process.execPath, args, { env, stdio: 'inherit' });
const tests = run(['node_modules/@playwright/test/cli.js', 'test']);
const gate = run(['scripts/gate.js', directory]);
writeFileSync('artifacts/latest.json', JSON.stringify({
  run_id: id,
  evidence_directory: directory,
  tests_exit_code: tests.status,
  gate_exit_code: gate.status,
  telemetry_mode: useOtlp ? 'file+otlp' : 'file',
  otlp_endpoint: useOtlp ? env.OTEL_EXPORTER_OTLP_ENDPOINT : null,
}, null, 2));
console.log(`Evidence: ${directory}`);
process.exitCode = tests.status === 0 && gate.status === 0 ? 0 : 1;
