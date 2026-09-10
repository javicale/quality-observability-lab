# Five-minute demo

## Prepare

Install Node.js 24. Run `npm ci`, then `npx playwright install chromium`. Close anything already using port 3000. Run `npm test` from the repository root. On Linux, browser system dependencies may require `npx playwright install --with-deps chromium`.

## Explain while showing evidence

1. Open `src/index.html` through `npm start` at `http://127.0.0.1:3000` for an interactive checkout. Choose the failure experiment and show the synthetic error. Stop this manual server before automated tests.
2. Run `npm run demo`. Explain that a healthy checkout passes and the deliberate 500 fails the business expectation, as intended.
3. Read `artifacts/latest.json` and open `error.json` in its evidence directory. Copy its `trace_id` and `test_run_id`.
4. Find the IDs in `traces.jsonl`: the checkout span is ERROR; its inventory child contains the synthetic exception. The child points to the server span.
5. Find the same IDs in `logs.jsonl`: `checkout.failed` is attached to that server span.
6. Open `metrics.jsonl`: error and success have separate status/scenario points. Use the latest cumulative snapshot, never a sum of snapshots.
7. Run `npm run report` and inspect the expected failure, screenshot, video and Playwright trace. Browser traces and OTel traces are different artifacts joined by the scenario evidence.
8. Open `quality-gate.json`. Explain why detecting the known failure is a successful experiment, while the business outcome is still FAIL.

To make the business failure visibly red, run `node scripts/run-lab.js --raw-failure`. This deliberately exits nonzero. Run `npm run demo` again to return to the normal experiment.

## Interview explanation

“I built a learning lab to investigate how test evidence can explain backend failures. Playwright propagates a run ID and W3C trace context into a synthetic checkout. OpenTelemetry records server and child spans, correlated logs and bounded metrics. A deliberate 500 exercises the failure path. A deterministic gate verifies that the evidence connects correctly; it does not approve a production release.”

## Troubleshooting

| Symptom | Action |
|---|---|
| Port 3000 already used | Stop the earlier manual server; tests refuse to reuse it |
| Browser executable missing | Run `npx playwright install chromium` |
| Missing Linux libraries | Run `npx playwright install --with-deps chromium` |
| Gate rejects evidence | Inspect the current run, not a previous UUID directory; read the first failed assertion |
| 400 in manual API request | Supply an alphanumeric/underscore/hyphen `x-test-run-id` up to 100 characters |
| 405 in manual API request | Checkout requires POST |
| Failure shown as expected | Correct in normal demo; raw-failure mode removes that annotation |

CI: open the repository Actions tab, select the exact commit's Quality Observability Gate run and download `quality-observability-evidence`. No secret configuration is required.
