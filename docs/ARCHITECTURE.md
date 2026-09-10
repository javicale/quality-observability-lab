# Architecture

## Reproducible baseline

Node.js 24 runs a small HTTP server and static checkout page. Playwright starts the server, uses a real Chromium browser and shuts it down after the tests. Each invocation creates a UUID evidence directory so a previous run cannot satisfy the current gate. Dependencies are pinned in `package-lock.json`; CI uses `npm ci`.

The browser sends `x-test-run-id` and W3C `traceparent`. The backend extracts that remote context with OpenTelemetry, creates a SERVER span and a child `inventory.reserve` span. The child operation is synthetic and does not represent a real database call. The error scenario records an exception and marks both spans as errors. An OTel log is emitted inside the active server span. Metrics use bounded route/status/scenario attributes.

## Dual telemetry architecture

The lab deliberately keeps two complementary paths:

1. **Deterministic local evidence** — SDK records are written to JSON/JSONL and verified by `scripts/gate.js`.
2. **OTLP integration** — when `OTEL_EXPORTER_OTLP_ENDPOINT` is enabled, traces, logs and metrics are also exported over OTLP/HTTP to the local `grafana/otel-lgtm` stack.

The LGTM image packages an OpenTelemetry Collector with Tempo, Loki, Prometheus and Grafana for development/demo use. `scripts/verify-stack.js` queries each backend and fails unless both scenario traces, correlated logs, the request metric and the provisioned Grafana dashboard are observable.

## Decisions and tradeoffs

| Decision | Reason | Cost / boundary |
|---|---|---|
| Keep file exporters | Evidence is inspectable and CI can validate relationships deterministically | Custom JSONL is not an OTLP serialization contract |
| Add OTLP/HTTP exporters | Prove real collector/backend ingestion instead of only local records | Requires Docker and an ephemeral integration stack |
| Use `grafana/otel-lgtm` | Reproducible all-in-one local observability environment | Demo image, not a production topology |
| Verify backends by API | CI proves queryability, not just that containers started | Verification is tailored to this controlled lab |
| Manual instrumentation | Make propagation and span relationships explicit | Only checkout is instrumented |
| Serial browser scenarios | Predictable isolated demonstration | No concurrency or throughput claim |
| Flush before response | Tests can inspect completed exports deterministically | Adds latency; not a production design |
| Metrics omit run IDs | Prevent unbounded metric cardinality | Metrics correlate by scenario/status, not individual trace |
| Expected final assertion failure | Exercise failure evidence while keeping experiment CI meaningful | Experiment success is different from application correctness |
| Loopback-only bindings | Keep the intentionally vulnerable demo local | No remote/container-host exposure supported |

## Data flow and ownership

`scripts/run-lab.js` owns the execution ID, evidence directory and telemetry mode. `tests/e2e/checkout.spec.js` owns scenario IDs, remote trace context and browser records. `src/telemetry.js` owns SDK providers plus file and optional OTLP exporters. `scripts/gate.js` verifies completed file evidence. `scripts/verify-stack.js` verifies OTLP ingestion/query behavior. Docker Compose owns the ephemeral LGTM process topology. GitHub Actions owns reproducible execution and artifact retention.

## Failure model

The injected checkout failure is application behavior under test, not infrastructure failure. The deterministic gate must prove that the failure is represented consistently across browser evidence, response, server span, child span, exception, correlated log and metrics. Stack mode then proves the corresponding traces/logs/metrics survive the OTLP path into their backends.

A green workflow therefore means **the experiment detected and explained the known failure correctly**. It does not mean the failing checkout would be acceptable in production and it does not produce a release decision.
