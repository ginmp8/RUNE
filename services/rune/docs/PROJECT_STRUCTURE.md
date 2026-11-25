# Project structure

```text
services/rune/
├── Rune.slnx
├── apps/
│   ├── rune-api/       ASP.NET Core API; deployable
│   ├── rune-worker/    Chromium worker; deployable
│   ├── rune-studio/    Streamlit client; deployable
│   └── rune-cli/       operational CLI
├── src/
│   ├── engine/         compilation, security, rendering, browser, export, ownership
│   ├── import/         PDF import providers and conversion policy
│   ├── dispatching/    local command transport
│   ├── application/    use cases and transport-neutral render-job processing
│   ├── contracts/      HTTP, job, and event contracts
│   └── abstractions/   messaging and storage ports
├── sdk/
│   ├── dotnet/
│   ├── python/
│   └── typescript/
├── assets/             shared CSS, browser runtimes, and pinned vendor assets
├── schemas/            versioned external JSON contracts and examples
├── tests/              engine, jobs, and browser tests
├── examples/
├── docs/               RUNE-owned documentation and feature catalog
└── tools/              validators and asset installer

messaging/nats/
├── src/                concrete NATS adapter
├── tests/              transport contract tests
├── server/             local server Dockerfile and configuration
└── docs/               subjects and JetStream operation
```

Only API, worker, and Studio are RUNE service deployments. The CLI and SDKs are consumers/tools. The root solution is the aggregate workspace view; `services/rune/Rune.slnx` deliberately excludes the concrete NATS adapter.
