# RUNE

RUNE is a local .NET 10 document rendering workspace for Markdown, HTML, PDF input, and composite documents with bounded native PDF page import. It generates interactive HTML, structured JSON, static HTML, PDF, PDF/A, PNG, JPEG, SVG, and related artifacts through a local API, CLI, worker, and authoring client.

RUNE source code is licensed under the MIT License. Bundled third-party components retain their own licenses and are listed in `services/rune/THIRD_PARTY_NOTICES.md`; those component licenses do not change the RUNE project license or automatically relicense generated documents.

## Deployable applications

- `rune-api`: compiles Markdown or HTML, queues PDF-to-HTML conversions and browser exports, supports explicit local or NATS dispatch, and exposes status, cancellation, retry, events, schemas, reports, and artifacts.
- `rune-worker`: consumes render requests through the shared processor, maintains leases, converts PDF input or renders in Chromium, composes supported native PDF pages, exports artifacts, and records progress.
- `rune-studio`: Streamlit editor, preview, export, job management, and searchable feature documentation.
- `messaging/nats/server`: local development NATS/JetStream infrastructure. It is not part of the RUNE rendering domain.

`rune-cli` is an operational tool and is not deployed as a service.

## Repository boundaries

```text
services/rune/       RUNE applications, engine, contracts, SDKs, tests, docs, and assets
messaging/nats/      concrete NATS adapter, local server, tests, and transport documentation
scripts/             workspace installation, execution, validation, smoke, and packaging commands
```

## Source checkout

Clone this repository and use the root solution. The source tree retains the 0.18.0 product baseline; it is not a newly promoted or repackaged release. See [import provenance](services/rune/docs/releases/IMPORT_0.18.0.md) and [release notes](RELEASE_NOTES.md).

The bundled renderer distributions, font assets, licenses, and native PDF fixtures are intentional, pinned runtime or test inputs. Release archives, generated checksums, SBOMs, build output, and local state are not tracked.

## Local execution

```bash
./scripts/install.sh
./scripts/run.sh
```

- RUNE API: `http://localhost:8080`
- RUNE Studio: `http://localhost:8501`
- NATS monitoring: `http://localhost:8222`

Stop the environment with:

```bash
./scripts/stop.sh
```

## Validation

```bash
./scripts/test.sh
```

The full test command requires Docker. Package-free .NET validation can also be executed with `services/rune/tools/Rune.Validation` when a local .NET 10 SDK is available.

See `LICENSE`, `services/rune/THIRD_PARTY_NOTICES.md`, `services/rune/docs/README.md`, `messaging/nats/docs/README.md`, `RELEASE_NOTES.md`, and `VALIDATION.md`.

## RUNE 0.18.0 feature-complete implementation line

The original RUNE 0.18.0 implementation addresses the nine capability gaps identified against the immutable 0.17.1 baseline: contract-grade page decorations, official SchemaTex integration, PDF-to-HTML conversion, deterministic typography, typed templates, content-addressed render cache, asynchronous artifact comparison, composite assembly, and atomic multi-output publication.

Public API, CLI, Studio, schemas, events, and the .NET, Python, and TypeScript SDKs now use the same normalized contracts. The release retains the distributed-resilience and native-PDF behavior from the 0.17.x line, while enforcing encrypted-PDF rejection, artifact-addressed comparison jobs, deterministic renderer/font identities, and fail-closed publication.

```bash
python3 scripts/validate_workspace.py --root .
python3 services/rune/tools/validate_feature_catalog.py
python3 services/rune/tools/validate_reference_equivalence.py
dotnet restore RUNE.slnx
dotnet build RUNE.slnx -c Release --no-restore
```

See `RELEASE_NOTES.md`, `VALIDATION.md`, `SPECIFICATION_CONVERGENCE_0.18.0.md`, and the feature catalog under `services/rune/docs/catalog/`. Docker/Compose, long-running load/soak, exhaustive independent PDF/A validation, signing, and production promotion remain separate release gates.
