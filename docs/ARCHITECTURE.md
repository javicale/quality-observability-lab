# Architecture

## Reproducible baseline

Node.js 24 runs a small HTTP server and static checkout page. Playwright starts the server, uses a real Chromium browser and shuts it down after the tests. Each invocation creates a UUID directory, preventing a previous run from satisfying the current evidence gate. Dependencies are pinned in `package-lock.json`; CI uses `npm ci`.

The page sends `x-test-run-id` and W3C `traceparent`. The backend extracts the remote context with OpenTelemetry, creates a SERVER span and a child `inventory.reserve` span. The child is synthetic: it is not a database call. The error scenario records an exception and marks both spans as errors. An OTel log is emitted inside the active server span. Metrics use bounded route/status/scenario attributes.

## Decisions and tradeoffs

| Decision | Reason | Cost / boundary |
|---|---|---|
| Local SDK exporters | Read every record; run without services or secrets | Custom JSONL, not OTLP; no visualization backend |
| Manual instrumentation | Make context propagation and span relationships explicit | Only checkout is instrumented |
| Serial browser scenarios | Predictable isolated demonstration | No concurrency or throughput claim |
| Flush before response | Tests can inspect completed exports deterministically | Instrumentation adds latency; not a production design |
| Metrics omit run IDs | Prevent unbounded metric cardinality | Metrics correlate by scenario, not individual test |
| Expected final assertion failure | Exercise failure evidence while keeping experiment CI meaningful | A lab verdict is different from application correctness |
| Loopback binding | Keep the intentionally vulnerable demo local | No container/remote binding supported |

## Data flow and ownership

`scripts/run-lab.js` owns execution ID and evidence directory. `tests/e2e/checkout.spec.js` owns scenario IDs, trace context and browser records. `src/telemetry.js` owns SDK providers and exports. `scripts/gate.js` reads immutable completed records and verifies cross-signal relationships. GitHub Actions owns artifact retention.

No collector or external service is silently assumed. A future OTLP path should export to a local collector, verify ingest and query behavior, and add a separately tested compose stack before claiming support.
