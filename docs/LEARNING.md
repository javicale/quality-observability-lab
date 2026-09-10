# Learning notes

## Research question

Can an automated test failure be tied to a specific backend operation and supporting evidence without a commercial observability account?

This baseline explores that question with a deliberately small system. It demonstrates correlation and deterministic evidence validation. It does not measure MTTR improvements or establish professional production observability expertise.

## Concepts in plain language

- A test tells us whether an expectation holds.
- A trace shows the operations involved in a request.
- A span is one operation within that trace.
- A log records a discrete event; IDs let us connect it to the operation.
- A metric aggregates measurements; it should not become a list of unique request IDs.
- Evidence captures enough context to inspect a claim after execution.
- A quality gate checks explicit rules and must itself have negative tests.

## Findings encoded in this lab

1. Green experiment CI and a failing business operation can coexist honestly when expected failure is explicit and independently verified.
2. A matching trace ID alone is insufficient: parent IDs and log span IDs catch weaker or broken correlations.
3. Metrics and traces have different granularity. Bounded metric labels prevent a convenient test ID from causing unbounded series growth.
4. Browser trace files are not backend OpenTelemetry traces. The evidence manifest bridges them.
5. Export timing matters. This baseline flushes before responding to make evidence deterministic, at the cost of extra response latency.
6. A gate that has only a passing example is weak evidence. Mutation tests show the gate rejects missing signals and broken relationships.

## Practice exercises

Remove trace propagation and observe the gate failure. Remove a log export and confirm it cannot pass. Change the injected response to 200 and check that the expected failure disappears and the experiment fails. Restore each change before continuing. Compare normal demo and raw-failure mode, then explain their different exit codes.

## Future experiments (not implemented)

- OTLP + local collector + trace/metric/log visualization with verified ingestion.
- Exported test root spans and metric exemplars.
- Parallel execution, test attempt IDs and retries with explicit flakiness accounting.
- Controlled latency injection, a defined latency budget and statistically meaningful repetition.
- Real synthetic database dependency and cross-service propagation.
- Versioned evidence schema validation, redaction tests and artifact integrity checks.

Keep future claims tied to executed checks and saved evidence. Treat this as R&D, not a production reference architecture.
