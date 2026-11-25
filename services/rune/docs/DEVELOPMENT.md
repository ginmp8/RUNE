# Development

## Requirements

- Docker with Compose for the supported complete local path.
- Optional .NET SDK 10.0.302 for direct package-free builds.
- Python 3.13 and Node.js for direct client and validator checks.

## Commands

```bash
./scripts/install.sh   # build images and install pinned browser assets through Docker
./scripts/run.sh       # start NATS, API, worker, and Studio
./scripts/test.sh      # complete validation
./scripts/stop.sh      # stop services and remove local containers
```

PowerShell and Batch entry points mirror the supported commands.

## Boundaries

- Put reusable rendering behavior under `services/rune/src`.
- Put executable composition under `services/rune/apps`.
- Put public clients under `services/rune/sdk`.
- Put concrete NATS code and operations under `messaging/nats`.
- Keep package versions in `Directory.Packages.props`.
- Keep project-owned source, diagnostics, tests, examples, and documentation in English.
