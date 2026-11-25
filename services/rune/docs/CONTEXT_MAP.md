# RUNE 0.7.0 implementation context

## Scope

- Extend the prior RUNE line without mutating published releases.
- Implement the mapped Markdown, HTML, renderer, output, job, Studio, CLI, SDK, schema, documentation, Docker, and NATS capabilities.
- Keep concrete NATS code outside `services/rune/src`.
- Use Markdown PDF Studio 1.8.7 as the declared functional target.

## Primary surfaces

- `services/rune/src`: compiler, ownership, rendering, browser, jobs, contracts, and abstractions.
- `services/rune/apps`: API, worker, Studio, and CLI composition.
- `services/rune/sdk`: typed clients.
- `services/rune/tests`: compatibility, job, and browser proof.
- `messaging/nats`: JetStream adapter and local infrastructure.
- `services/rune/docs/catalog`: feature ownership and traceability.

## Validation boundaries

Package-free .NET, Python, JavaScript, schemas, and catalog checks can execute without Docker. NuGet-dependent compilation uses the shared offline feed. Chromium and PDF/A may execute locally when the required system tools are present. Live NATS and Compose remain separate environment-dependent gates in `VALIDATION.md`.
