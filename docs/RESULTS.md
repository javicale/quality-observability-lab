# Final verified results

## Closure status

The Quality Observability Lab reached its intended R&D scope on 2026-09-10.

The final implemented system supports two independent validation contracts:

- **Deterministic evidence contract** — local OpenTelemetry records plus browser evidence are correlated and validated by a fail-closed quality gate with negative unit tests.
- **OTLP stack contract** — the same synthetic application telemetry is exported over OTLP/HTTP into the local LGTM stack and verified through Grafana, Tempo, Loki and Prometheus APIs.

## Verified behavior

A successful stack run demonstrated:

```text
Healthy checkout        PASS
Injected HTTP 500       FAIL   (intentional business failure)
Failure detection       PASS
Evidence correlation    PASS
Deterministic gate      PASS
Grafana                  PASS
Tempo                    PASS
Loki                     PASS
Prometheus               PASS
OTLP stack               PASS
```

The successful integration run recorded exact Tempo traces for both success and error scenarios, correlated Loki log records preserving `trace_id` and `test_run_id`, the `lab_http_requests_total` metric in Prometheus, and the provisioned `Quality Observability Lab` dashboard in Grafana.

After the functional stack verification passed, the Docker Compose endpoints were restricted to `127.0.0.1`; the subsequent CI run also completed successfully.

## Integration defect discovered and fixed

The first OTLP integration attempts exposed a real cross-signal defect: traces and metrics were queryable but logs were absent from Loki. The issue was not the Collector or Loki. The OTLP `SimpleLogRecordProcessor` was constructed using an incompatible argument shape for the current OpenTelemetry JS logs SDK. Updating the processor configuration restored OTLP log export, after which the complete stack contract passed.

This defect is a core learning result: **partial telemetry success is not evidence that the observability path is complete**. Each signal needs its own executable verification.

## What this repository proves

It proves that, for this controlled synthetic topology, an intentionally failing browser scenario can be connected to backend execution evidence through explicit trace/run identifiers, validated deterministically, transported through OTLP, and queried from real local observability backends.

It does **not** prove production readiness, improved MTTR, release safety, distributed-system scalability, SLO compliance or production security. Those claims would require different experiments and evidence.

## Lab closure decision

No additional feature expansion is required for this repository. Future topics such as exemplars, parallel test attempts, signed evidence, multi-service propagation or AI-assisted diagnosis should be treated as separate experiments so this lab remains small, reproducible and defensible.
