# Phase 2 — Local OTLP + LGTM stack

This branch adds the final observability experiment before the lab is closed:

```text
Playwright
   ↓
Synthetic checkout API
   ↓
OpenTelemetry SDK
   ├── local JSON/JSONL evidence
   └── OTLP/HTTP
          ↓
   OpenTelemetry Collector
          ↓
 Prometheus · Tempo · Loki
          ↓
        Grafana
```

The Docker stack uses the official `grafana/otel-lgtm` development/demo image. File-based evidence remains the deterministic source for the core quality gate; the stack contract separately proves that the same application telemetry is accepted by OTLP and becomes queryable in the local observability backends.
