# Security and scope

This application intentionally exposes an injected error for learning. The synthetic application binds only to `127.0.0.1`. The Docker Compose observability endpoints are also published only on loopback: Grafana, OTLP, Loki, Tempo and Prometheus are not intentionally exposed to the network.

All orders and failures are synthetic. No credentials, customer data, real payments, external business APIs or repository secrets are required. Telemetry records an allowlisted set of attributes. The run header is validated for shape; it provides correlation, not authentication.

Grafana anonymous access is enabled for the local demo stack so the experiment can run without credentials. That configuration is acceptable only because the published ports are loopback-bound. Do not reuse this authentication configuration in a shared or production environment.

CI has read-only repository permissions and uploads generated evidence for 14 days. Local evidence, browser profiles and environment files are ignored by Git. Browser evidence can contain everything visible on a page, so the lab must remain synthetic.

The project has no production security guarantees, persistence controls, authentication model, authorization model, rate limiting, TLS termination, signed evidence, durable telemetry retention or hardened network topology. Review dependencies and redesign the deployment model before adapting any code to a real environment.
