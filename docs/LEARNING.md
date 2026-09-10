# Learning notes

## Research question

Can an automated test failure be tied to a specific backend operation and supporting evidence, and can that evidence survive a real OTLP path into queryable observability backends without a commercial observability account?

This lab demonstrates both pieces in a deliberately small synthetic system. It does not measure MTTR improvement or establish a production observability reference architecture.

## Concepts in plain language

- A test tells us whether an expectation holds.
- A trace shows the operations involved in a request.
- A span is one operation within that trace.
- A log records a discrete event; trace/span/run IDs connect it to execution context.
- A metric aggregates measurements and should not become a list of unique request IDs.
- OTLP is the telemetry transport contract, not the visualization backend itself.
- Evidence captures enough context to inspect a claim after execution.
- A quality gate checks explicit rules and should have negative tests.

## Findings encoded in this lab

1. Green experiment CI and a failing business operation can coexist honestly when expected failure is explicit and independently verified.
2. A matching trace ID alone is insufficient: parent IDs and log span IDs catch weaker or broken correlations.
3. Metrics and traces have different granularity. Bounded metric labels prevent convenient test IDs from creating unbounded series.
4. Browser Playwright traces are not backend OpenTelemetry traces. The evidence manifest bridges them.
5. Export timing matters. This lab flushes before responding to make evidence deterministic, at the cost of extra response latency.
6. A gate with only a passing example is weak evidence. Mutation tests prove rejection of missing signals and broken relationships.
7. Starting an observability stack is not proof of observability. The CI contract must query the destination systems.
8. Cross-signal completeness matters. During implementation, traces and metrics were present while logs were missing because of a log processor configuration mismatch; backend-specific verification exposed the gap.
9. Local file evidence and visual observability serve different purposes. The files are deterministic and directly auditable; Tempo/Loki/Prometheus/Grafana demonstrate realistic ingestion and investigation workflows.
10. A lab PASS is an experiment verdict, not release authority.

## Practice exercises

Remove trace propagation and observe the deterministic gate fail. Remove a log export and confirm correlation cannot pass. Change the injected response to 200 and confirm the expected failure disappears and the experiment fails. In stack mode, disable one OTLP exporter and observe the corresponding backend verification time out. Restore each change before continuing.

## Possible future experiments

The lab is intentionally closed at this stage. Natural follow-on experiments belong in separate work rather than silently expanding this repository:

- Export a browser/test root span and evaluate trace-link semantics.
- Add metric exemplars and compare exemplar-based navigation with explicit evidence manifests.
- Explore parallel execution, attempt IDs and retries with honest flakiness accounting.
- Add controlled latency injection with a defined budget and statistically meaningful repetition.
- Introduce a real synthetic database dependency and cross-service propagation.
- Add versioned evidence schema validation, integrity signing and redaction tests.

Keep any future claims tied to executed checks and saved evidence. Treat this repository as a completed R&D portfolio lab, not a production platform.
