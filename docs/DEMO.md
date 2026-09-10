# Five-minute demo

## Prepare

Install Node.js 24 and run:

```sh
npm ci
npx playwright install chromium
```

On Linux, browser system dependencies may require `npx playwright install --with-deps chromium`. Port 3000 must be available. Docker is only required for the OTLP/Grafana portion.

## Part 1 — deterministic evidence

1. Run `npm run demo`.
2. Explain that the healthy checkout passes and the deliberate HTTP 500 fails the business expectation, as intended.
3. Read `artifacts/latest.json` and open `error.json` in its evidence directory. Copy `trace_id` and `test_run_id`.
4. Find those IDs in `traces.jsonl`: the checkout span is ERROR and its inventory child contains the synthetic exception.
5. Find the same IDs in `logs.jsonl`: `checkout.failed` is attached to the server span.
6. Inspect `metrics.jsonl`: success and error have separate bounded scenario/status points. Use the latest cumulative snapshot, never a sum of snapshots.
7. Open `quality-gate.json`. Explain why detecting the known failure is a successful experiment even though the business outcome remains FAIL.
8. Run `npm run report` to inspect screenshot, video and Playwright trace evidence.

To make the business failure visibly red, run `node scripts/run-lab.js --raw-failure`. This deliberately exits nonzero.

## Part 2 — real OTLP + local observability stack

```sh
npm run stack:up
npm run demo:stack
```

The command waits for Grafana, Tempo, Loki and Prometheus, reruns the experiment with dual `file+otlp` export, then validates the backends programmatically.

Open Grafana at `http://127.0.0.1:3001` and show the provisioned **Quality Observability Lab** dashboard. Use the latest run's `trace_id` / `test_run_id` to explain how the visual stack and file evidence describe the same synthetic execution.

Then open `stack-verification.json`. A valid completed experiment shows PASS for Grafana, Tempo, Loki and Prometheus and records the trace IDs used for backend verification.

Stop the stack when finished:

```sh
npm run stack:down
```

## Interview explanation

“I built a reproducible learning lab to investigate how automated test evidence can explain backend failures. Playwright propagates a run ID and W3C trace context into a synthetic checkout. OpenTelemetry records server and child spans, correlated logs and bounded metrics. The same telemetry is both written to inspectable evidence files and exported over OTLP to a local Collector/LGTM stack. A deterministic gate validates relationships in the files, while a second integration contract queries Tempo, Loki, Prometheus and Grafana to prove real ingestion. A deliberate 500 exercises the failure path; none of these gates approve a production release.”

## Troubleshooting

| Symptom | Action |
|---|---|
| Port 3000 already used | Stop the earlier manual server; tests refuse to reuse it |
| Port 3001/3100/3200/4317/4318/9090 used | Stop the conflicting service before stack mode |
| Browser executable missing | Run `npx playwright install chromium` |
| Missing Linux libraries | Run `npx playwright install --with-deps chromium` |
| Gate rejects evidence | Inspect the current UUID run and read the first failed assertion |
| Stack verification times out | Run `npm run stack:logs`; confirm the expected signal reached the backend |
| 400 in manual API request | Supply an alphanumeric/underscore/hyphen `x-test-run-id` up to 100 characters |
| 405 in manual API request | Checkout requires POST |
| Failure shown as expected | Correct in normal demo; raw-failure mode removes that annotation |

CI contains two jobs: `deterministic-evidence` and `otel-stack-contract`. Both upload evidence artifacts and require no secret configuration.
