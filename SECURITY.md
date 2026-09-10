# Security and scope

This application intentionally exposes an injected error for learning. It binds only to `127.0.0.1`. Do not expose it to the internet or connect it to customer services.

All orders and failures are synthetic. No credentials, customer data, real payments, external APIs or repository secrets are required. Telemetry records an allowlisted set of attributes. The run header is validated for shape; it provides correlation, not authentication.

CI has read-only repository permissions and uploads generated evidence for 14 days. Local evidence, browser profiles and environment files are ignored by Git. Browser evidence can contain everything visible in a page: keep the lab synthetic.

The project has no production security guarantees, persistence controls, authentication, rate limiting or signed evidence. Review dependencies and changes before adapting any code elsewhere.
