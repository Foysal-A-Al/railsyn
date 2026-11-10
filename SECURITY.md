# Security

RailSyn is a local simulation prototype. It is not an industrial controller.

- Native execution binds to loopback port 8630. Docker listens internally and publishes only host loopback port 8640. Both validate Host and Origin, use a per-process mutation token and serve a fixed file allowlist.
- JSON input is bounded and validated. External sensor packets have freshness and sequence checks.
- `/api/hardware-command` always rejects. No real robot SDK or physical motion output is included.
- Simulation Stop does not replace a physical emergency stop. Arbitrary part combinations do not imply real-world compatibility.
- Keep tokens, credentials, `.env` files, local browser profiles, recordings and run exports out of Git. No API key is needed to run RailSyn.
- Do not expose ports 8630 or 8640 to the LAN or Internet. Remote device authentication and industrial commissioning are outside this prototype.

Report a suspected issue privately to the repository owner through an existing private contact channel. Share affected paths and a minimal non-secret reproduction; do not include credentials or production data.
