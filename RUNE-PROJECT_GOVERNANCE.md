# RUNE Project Organization and Versioning Policy

**Status:** Active  
**Effective date:** 2026-07-25  
**Last updated:** 2026-07-26  
**Historical baseline:** `0.1.0`  
**Scope:** RUNE workspace, source code, contracts, schemas, assets, packages, documentation, and releases  
**Canonical source-control location:** `RUNE-PROJECT_GOVERNANCE.md` at the repository root

## 1. Purpose

This policy defines how RUNE is organized, versioned, validated, packaged, published, indexed, and maintained.

It exists to ensure that:

- every responsibility has one clear owner and location;
- dependencies follow explicit architectural boundaries;
- versions communicate consumer impact;
- source, documentation, images, and packages share one release identity;
- published releases remain immutable, reproducible, and auditable;
- compatibility, security, performance, and readiness claims are supported by executed evidence;
- project-owned source, user-facing messages, examples, tests, and documentation use English.

Version `0.1.0` is the historical baseline created before this policy was fully adopted. It must not be silently rebuilt. Any distributed content change after that baseline requires a new version.

## 2. Product profile and public contract

RUNE is a unified-version workspace distributed as one product. It includes:

- an ASP.NET Core API;
- a Chromium rendering worker;
- a Streamlit Studio client;
- a development and automation CLI;
- rendering engine and application libraries;
- HTTP, job, and event contracts;
- messaging and storage abstractions;
- a NATS/JetStream adapter;
- external JSON schemas;
- browser rendering assets;
- install, run, test, validation, and stop scripts;
- Docker images, Compose configuration, and a source ZIP.

The public contract includes any documented or consumable behavior, including:

- API routes, methods, status codes, payloads, defaults, limits, and errors;
- event subjects, headers, ordering, delivery, acknowledgement, and retry semantics;
- render request, render event, and render package schemas;
- CLI and script commands, arguments, output, exit codes, files, and side effects;
- accepted Markdown and HTML formats;
- sanitization, readiness, timeout, and rendering behavior;
- generated artifact formats and properties;
- configuration, environment variables, ports, volumes, permissions, and images;
- runtime, SDK, Chromium, NATS, and dependency requirements;
- idempotency, job state, storage, replay, and recovery behavior;
- the distributed package layout and required files;
- user-facing default labels, diagnostics, and error messages when documented or tested.

A change is incompatible when a supported consumer must change code, configuration, data, permissions, automation, process, parsing, snapshots, or documented expectations to continue safely.

## 3. Workspace organization

### 3.1 Canonical source tree

```text
RUNE/
├── VERSION
├── Directory.Build.props
├── Directory.Packages.props
├── global.json
├── RUNE.slnx
├── RUNE-PROJECT_GOVERNANCE.md
├── services/
│   └── rune/
│       ├── apps/
│       ├── src/
│       │   ├── engine/
│       │   ├── application/
│       │   ├── contracts/
│       │   └── abstractions/
│       ├── assets/
│       ├── schemas/
│       ├── sdk/
│       ├── tests/
│       ├── docs/
│       ├── examples/
│       └── tools/
├── messaging/
│   └── nats/
└── scripts/
```

The root contains only workspace-wide identity, configuration, governance, documentation, release metadata, and automation. Domain implementation must not be added directly to the root.

### 3.2 Directory ownership

| Location | Owns | Must not own |
|---|---|---|
| `services/rune/apps` | Executable applications and composition roots | Reusable domain rules or duplicated contracts |
| `services/rune/src/engine` | Compilation, normalization, security, rendering, and export | App, Streamlit, or concrete transport dependencies |
| `services/rune/src/application` | Use cases and orchestration | UI details or direct NATS coupling |
| `services/rune/src/contracts` | HTTP, job, and event contracts | Infrastructure implementation or operational logic |
| `services/rune/src/abstractions` | Messaging and storage ports | Concrete adapters |
| `services/rune/assets` | Shared CSS, JavaScript, renderers, and browser assets | Unpinned downloads or mandatory remote runtime code |
| `services/rune/schemas` | Versioned external JSON contracts | Unversioned schemas or schemas without compatibility tests |
| `services/rune/sdk` | Typed clients for supported consumer ecosystems | Rendering rules, server orchestration, or transport infrastructure |
| `services/rune/tests` | Product, contract, compatibility, and regression tests | Untraceable fixtures presented as executed evidence |
| `services/rune/docs` | Architecture, API, rendering, development, testing, and release guidance | Adapter-specific transport documentation |
| `messaging/nats` | NATS/JetStream adapter, local server, and adapter documentation | Rendering-domain rules |
| `scripts` | Workspace install, run, test, validation, packaging, and stop commands | Product business logic or secrets |

### 3.3 Executable units

- `rune-api`: HTTP service;
- `rune-worker`: asynchronous Chromium processing;
- `rune-studio`: Streamlit client;
- `rune-cli`: local and automation tool;
- local NATS server: development and integration infrastructure.

Only the API, worker, and Studio are product service deployments. The CLI is an operational tool. The local NATS server is environment infrastructure, not part of the rendering domain.

### 3.4 Dependency direction

```text
apps
  -> application
  -> engine, contracts, abstractions

sdk
  -> public contracts

concrete adapters
  -> abstractions, contracts
```

Mandatory rules:

1. libraries under `src` must not depend on projects under `apps`;
2. `engine`, `contracts`, and `abstractions` must not depend on the concrete NATS adapter;
3. `Rune.Messaging.Nats` may implement abstractions and consume contracts, but must not own rendering rules;
4. Studio must consume the API and must not access internal storage, NATS, or the worker directly;
5. each shared contract must have one owning project;
6. circular project dependencies are prohibited;
7. new concrete infrastructure must live outside the domain in a dedicated adapter directory;
8. the root solution is the aggregate view; focused solutions must not define divergent contracts.

### 3.5 Naming conventions

- .NET projects: `Rune.<Area>[.<Subarea>]`.
- Test projects: `<Project>.Tests`.
- Executable directories and service identifiers: kebab-case, such as `rune-api`.
- External schemas: `<contract>.v<major>.schema.json`.
- Governance documents: uppercase descriptive names prefixed with `RUNE-` when stored at the repository root.
- Equivalent scripts should maintain `.sh`, `.ps1`, and `.bat` parity when supported.
- Official images: `rune-api`, `rune-worker`, `rune-studio`, plus explicitly approved names.
- Git tags: `v<version>`, for example `v0.2.0`.
- Release library folders: `rune-<version>`, for example `rune-0.2.0`.
- Product ZIP and checksum: `RUNE-<version>.zip` and `RUNE-<version>.sha256`.

## 4. Language policy

English is the canonical language for project-owned material.

The following must be written in English:

- source identifiers, comments, diagnostics, errors, labels, accessibility text, and default titles;
- Markdown documentation, release documents, examples, fixtures, and test descriptions;
- schemas, contract descriptions, CLI help, script output, and operational messages;
- governance, migration, rollback, recovery, validation, and errata documents.

Exceptions are allowed only for:

- third-party files preserved verbatim;
- licenses and legal notices that must retain upstream text;
- intentionally multilingual test fixtures explicitly named with a locale and documented as such;
- user-provided content processed as input data.

An exception must not become the default project language. The workspace validation must reject known legacy Portuguese user-facing strings and documentation markers.

## 5. Sources of truth

### 5.1 Product version

`VERSION` at the repository root is the canonical product version.

Before publication, it must match:

- `VersionPrefix` in `Directory.Build.props`;
- application and package version declarations;
- API-reported version;
- the latest `CHANGELOG.md` section;
- the title and metadata in `RELEASE_NOTES.md`;
- the version declared in `VALIDATION.md`;
- ZIP and checksum names;
- Git tags and immutable image tags;
- version references in examples, manifests, and distributed documents.

No derived file may independently define the product version.

### 5.2 Dependencies

`Directory.Packages.props` is the canonical source for NuGet versions. Package versions must not be repeated in `.csproj` files unless the tool cannot support central management, the incompatibility is demonstrated, and the exception is documented and validated.

`global.json` defines the supported .NET SDK line. Changing the SDK major line or target framework is an operational compatibility change and must be classified explicitly.

Dockerfile base-image tags and build-time downloader constants are the canonical sources for container runtime and browser-asset pins. Normal builds must acquire those dependencies from authoritative upstream images, package registries, or explicitly approved upstream endpoints. Private archive paths and temporary sandbox locations are prohibited as product dependency sources.

An offline archive copy is a validation mirror only. It must preserve the exact upstream filename, version, platform, license material, and integrity evidence, and it may substitute only for network transfer in an isolated sandbox. It must not change the normal Dockerfile acquisition path or create a runtime network dependency.

### 5.3 External contracts

Schemas under `services/rune/schemas` are the canonical structured external contracts. C# types, documentation, examples, and tests must remain synchronized with the active schemas.

### 5.4 Documentation ownership

- `RUNE-PROJECT_GOVERNANCE.md`: organization, language, versioning, release identity, and immutability policy.
- The external release archive may maintain an offline SDK, NuGet, build, test, and diagnostic runbook; it is not a product dependency.
- `LAST_VERSION.json`: machine-readable pointer to the latest non-withdrawn release that passed the declared functional qualification.
- `LAST_VERSION.md`: human-readable summary of the same pointer and its limitations.
- `services/rune/docs/ARCHITECTURE.md`: technical architecture and responsibilities.
- `services/rune/docs/PROJECT_STRUCTURE.md`: internal source layout.
- `services/rune/docs/RELEASE_PROCESS.md`: practical release execution.
- `messaging/nats/docs`: adapter-specific contract and operations.
- `CHANGELOG.md`: cumulative observable history.
- `RELEASE_NOTES.md`: one release communication.
- `VALIDATION.md`: executed evidence, static checks, limitations, and verdict.

This policy prevails when a lower-level guide conflicts with it.

### 5.5 Functional references and recovery lineage

When a release names another artifact as a functional reference:

1. the exact named archive must be materialized and its identity recorded before compatibility claims are made;
2. exact upstream fixtures may be retained verbatim as reference evidence, including their original language, when the filename declares the reference version and project-owned documentation explains the exception;
3. project-owned fixtures, diagnostics, documentation, examples, and UI remain subject to the English-language policy;
4. reference behavior must be mapped to RUNE implementation, documentation, and test evidence;
5. a withdrawn or unproven runtime path must not be restored merely because source code or a dependency package exists;
6. recovery releases must preserve lineage, withdrawn versions, replacement behavior, limitations, and mandatory gates in `RECOVERY_<version>.md`.

For embedded browser renderers, the distributed renderer is the source of truth. A separate reference package, playground, or typed component library is not evidence that the embedded Studio/PDF path executes correctly.

## 6. Unified product version

RUNE uses one product version for the entire workspace and distributed package. A release jointly versions applications, internal libraries, contracts, schemas, assets, included adapters, scripts, documentation, and official images.

Individual projects must not receive independent public versions while they are distributed only as RUNE components. Independent versioning requires an explicit architecture decision, separate consumers, compatibility policy, pipeline, release identity, and migration guidance.

## 7. Semantic Versioning

The product version format is:

```text
MAJOR.MINOR.PATCH
```

### 7.1 Pre-1.0 line

While RUNE is `0.MINOR.PATCH`:

- `PATCH`: compatible correction within the current line;
- `MINOR`: compatible capability or incompatible contract/behavior change;
- `1.0.0`: explicit declaration of a stable public contract.

Compatibility across `0.x` versions is not guaranteed. Every incompatibility must still document impact, required action, migration, and rollback implications.

Examples:

| Change | From | To |
|---|---:|---:|
| Compatible timeout correction | `0.1.0` | `0.1.1` |
| Optional export format | `0.1.1` | `0.2.0` |
| User-facing default/error language change | `0.1.0` | `0.2.0` |
| Required API payload change | `0.2.0` | `0.3.0` |
| Promote the same artifact to another environment | `0.2.0` | no new version |

### 7.2 Stable line

After `1.0.0`:

- `PATCH`: compatible correction;
- `MINOR`: compatible capability or public deprecation;
- `MAJOR`: incompatible contract change, removal, or required migration.

The highest-impact included change determines the release increment.

### 7.3 Compatibility dimensions

Evaluate the dimensions relevant to the change:

- source compatibility;
- binary compatibility;
- schema and stored-data compatibility;
- behavioral compatibility, including defaults, errors, ordering, and side effects;
- operational compatibility, including configuration, permissions, resources, and migrations;
- backward compatibility;
- forward tolerance.

A defect correction is not automatically a patch when supported consumers rely on the previous behavior.

## 8. Prereleases, builds, and environments

Allowed prerelease channels:

```text
0.3.0-alpha.1
0.3.0-beta.1
0.3.0-rc.1
0.3.0
```

- `alpha`: incomplete or highly changeable;
- `beta`: feature-complete or nearly complete, still under validation;
- `rc`: release candidate accepting only release-blocking corrections;
- final: approved immutable release artifact.

Published prereleases are immutable and their numeric sequence must increase monotonically.

Product version, build, commit, artifact digest, deployment, and environment are separate identities:

```text
product_version: 0.3.0-rc.1
build_id: 8451
commit: a31cf82
artifact_sha256: <digest>
deployment_id: production-20260725-8451
environment: production
```

Promoting the same digest does not create a new product version.

## 9. Contract and schema versions

Product version and contract major version are distinct:

```text
Product: RUNE 0.4.2
Schema: render-request.v1.schema.json
```

Rules:

1. compatible corrections and extensions may retain the same contract major version;
2. incompatible schema semantics require a new schema major and an appropriate product version;
3. supported prior contract versions must remain documented and tested;
4. removing a supported contract version requires migration guidance and an incompatible product increment;
5. persisted or externally published messages must declare their contract version;
6. a schema identifier must never be reused for incompatible semantics;
7. examples and fixtures must state the contract version they validate.

## 10. Source repository and release archive structure

Git tracks the maintainable source tree. Generated release packages, checksums, SBOMs, and execution evidence are published separately from source control. The external release archive may retain this organization:

```text
release-archive/
├── RUNE-PROJECT_GOVERNANCE.md
├── RUNE-OFFLINE-SANDBOX.md
├── LAST_VERSION.json
├── LAST_VERSION.md
├── rune-0.1.0/
├── rune-0.2.0/
├── rune-0.2.1/
└── ...
```

Each release folder must contain at least:

```text
rune-<version>/
├── RUNE-<version>.zip
├── RUNE-<version>.sha256
├── CHANGELOG.md
├── RELEASE_NOTES.md
└── VALIDATION.md
```

Conditional documents:

- `BASELINE_<version>.md`: initial baseline or formal source lineage;
- `RECOVERY_<version>.md`: restoration of a functional line;
- `MIGRATION_<version>.md`: required actions for incompatible behavior, data, or configuration;
- `ERRATA_<version>.md`: factual correction without artifact replacement;
- `ROLLBACK_<version>.md`: rollback procedure too complex for release notes;
- SBOM, signatures, provenance, or attestations generated by trusted automation.

The folder prefix exists for governance and indexing. The semantic version remains the value after `rune-`; the folder name is not the product version itself.

## 11. Required ZIP content

The source package must have one `RUNE/` root and include at least:

```text
RUNE/
├── VERSION
├── Directory.Build.props
├── Directory.Packages.props
├── global.json
├── RUNE.slnx
├── RUNE-PROJECT_GOVERNANCE.md
├── README.md
├── CHANGELOG.md
├── RELEASE_NOTES.md
├── VALIDATION.md
├── TREE.txt
├── MANIFEST.sha256
├── services/
├── messaging/
└── scripts/
```

Packaging rules:

1. `VERSION`, `VersionPrefix`, application versions, and artifact names must match;
2. `TREE.txt` must represent the relevant final content;
3. `MANIFEST.sha256` must cover distributed files, excluding only itself when necessary;
4. temporary files, secrets, caches, IDE output, `.git`, and local build output must not be included;
5. build the ZIP from a clean checkout or equivalent controlled workspace;
6. extract the final ZIP into a new directory and validate it again;
7. calculate the external checksum only after final approval;
8. external `CHANGELOG.md`, `RELEASE_NOTES.md`, and `VALIDATION.md` copies must be byte-identical to the files inside the ZIP at publication time;
9. the external release folder must not contain an expanded source tree; its immutable source distribution is `RUNE-<version>.zip`. The Git repository contains the maintainable source checkout;
10. migration, rollback, recovery, and other release-specific documents copied beside the ZIP must also be byte-identical to their packaged counterparts.

## 12. Release documentation

### 12.1 Changelog

`CHANGELOG.md` is cumulative, reverse chronological, and outcome-oriented. Preferred categories are `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, and meaningful operator categories such as `Performance`, `Operations`, `Data`, `Documentation`, or `Tests`.

Do not use vague entries such as “refactored,” “updated,” or “miscellaneous improvements” without an observable effect.

### 12.2 Release notes

`RELEASE_NOTES.md` describes one release and should contain, when applicable:

1. version, date, release type, and artifact identity;
2. summary;
3. required actions;
4. breaking changes;
5. migration or upgrade instructions;
6. added and changed capabilities;
7. corrections and security notes;
8. known issues and limitations;
9. rollout, observability, and rollback;
10. checksum, image digest, SBOM, signature, or provenance.

Required actions and breaking changes must appear before general improvements.

### 12.3 Validation report

`VALIDATION.md` must separate:

- **executed:** command, environment, observed result, and evidence;
- **static validation:** inspection without runtime execution;
- **assumption:** unsupported conclusion not yet verified;
- **planned:** future gate;
- **not executed:** missing gate and reason.

A green pipeline alone does not prove compatibility, security, performance, or production readiness.

## 13. Minimum release gates

Run the following as applicable before final publication:

1. version synchronization validation;
2. English-language policy validation;
3. .NET restore, build, and tests;
4. Python tests for Studio and tools;
5. JSON, YAML, TOML, shell, PowerShell, batch, JavaScript, and CSS validation;
6. contract and schema tests;
7. builds of all official Docker images;
8. Compose startup and health checks;
9. API and Studio smoke tests;
10. NATS/JetStream publish and consume flow;
11. real worker execution in Chromium;
12. generation of every declared output format;
13. independent veraPDF validation when PDF/A conformance is claimed beyond generation;
14. Dockerfile/downloader pin review and exact offline-mirror parity when an isolated sandbox is used;
15. readiness and fail-closed timeout validation;
16. idempotency, duplicate delivery, retry, and recovery tests;
17. final ZIP extraction and repeated essential smokes;
18. byte-by-byte manifest verification;
19. external checksum verification;
20. dependency and vulnerability review;
21. documentation of every environment-specific gate not executed.

A release may be published with unexecuted gates only when the claim scope is explicitly reduced, limitations are documented, the artifact is not presented as validated for the absent environment, and no known critical risk is hidden by the omission.

### 13.1 Embedded renderer recovery gates

A release that changes or recovers an embedded asynchronous renderer must additionally validate:

1. the exact JavaScript and CSS files distributed in the ZIP and image;
2. execution in a real supported browser, not only string inspection or a separate package test;
3. completion of the global readiness barrier;
4. expected component, SVG, node, edge, and unique marker counts for representative complex fixtures;
5. generation of a real PDF from the same HTML path used by Studio preview;
6. execution through the complete API/Studio pipeline when that pipeline is part of the public behavior;
7. absence of withdrawn runtime files, dependency markers, or bootstrap code.

A source-only or static test may support these gates but cannot replace browser and PDF evidence. If the runtime environment is unavailable, `VALIDATION.md` must mark these gates not executed and the release claim must remain correspondingly limited.

## 14. Publication process

### 14.1 Prepare

1. freeze release scope;
2. identify affected consumers and contracts;
3. classify the highest-impact change;
4. choose the version;
5. update `VERSION` and all derived identities;
6. update changelog, release notes, migration, and rollback content;
7. run applicable gates.

### 14.2 Build the candidate

1. create the package with one `RUNE/` root;
2. generate `TREE.txt` and `MANIFEST.sha256`;
3. extract the ZIP into a clean directory;
4. validate the extracted content;
5. calculate the final ZIP SHA-256;
6. record commands, environment, and results in `VALIDATION.md`.

### 14.3 Publish

1. create immutable Git tag `v<version>`;
2. publish exactly the validated artifact;
3. publish images with immutable matching tags;
4. create the external immutable release entry for `rune-<version>`;
5. store ZIP, checksum, and required documentation;
6. prevent silent replacement.

### 14.4 Promote

Promote the same digest:

```text
development -> integration -> staging -> production
```

Environment-specific rebuilds of the approved release candidate are prohibited.

## 15. Immutability, correction, and withdrawal

After publication, a version, tag, image, ZIP, and checksum are immutable.

Do not:

- replace a ZIP under the same name or version;
- move a public tag;
- publish different image content under the same SemVer tag;
- edit history to conceal an error;
- change a checksum to legitimize a replaced artifact.

When artifact content changes, create a new version. When only an external factual statement needs correction and the artifact remains valid, publish `ERRATA_<version>.md` with the incorrect statement, correction, impact, date, origin, and confirmation that the artifact digest did not change.

A withdrawn release remains visible and is marked `WITHDRAWN` or `YANKED` with reason, impact, affected versions, recommended replacement, and rollback or upgrade guidance.

## 16. Rollback and operational compatibility

Every release must declare one strategy:

- direct rollback to the previous artifact;
- mandatory roll-forward;
- expand-migrate-contract;
- data or state restoration;
- documented irreversible incompatibility.

Before publication, review persisted jobs, queued events, schema versions in transit, artifact storage, configuration and secrets, Chromium assets, and whether older consumers can process new messages.

Irreversible changes require migration and must not rely on simple rollback.

## 17. Criteria for 1.0.0

RUNE may reach `1.0.0` only when these contracts are explicitly stable:

- API;
- events and subjects;
- jobs and idempotency;
- render request and render package;
- input and output formats;
- external schemas;
- CLI and official scripts;
- Docker configuration and operation;
- readiness, timeout, and failure behavior;
- upgrade, migration, and rollback policy.

Additionally, RUNE must have complete supported-contract documentation, automated critical gates, at least one fully validated installation and operation path, compatibility tests between relevant consecutive releases, a reproducible baseline, a repeatable immutable publication process, and an explicit supported-platform list.

`1.0.0` is a stability promise, not a feature-count milestone.

## 18. Governance changes and exceptions

Changing this external policy does not require a product version when it is not redistributed and does not alter the consumer contract. A new product version is required when the policy change affects distributed content, installation, operation, support, required behavior, or public contracts.

Exceptions must be explicit, time- or scope-bounded, technically justified, recorded in validation or an architecture decision, approved before publication, and re-evaluated in the next release.

No exception may authorize version reuse, hidden breaking changes, claims for unexecuted tests, secrets, silent contract breaks, non-English project-owned defaults, or replacement of an immutable artifact.

## 19. Release checklist

### Organization

- [ ] The file is in the owning directory.
- [ ] Dependency direction is preserved.
- [ ] No contract or source of truth is duplicated.
- [ ] Solutions, documentation, tests, and tree are current.
- [ ] Dependencies remain centralized.
- [ ] Dockerfiles and build scripts acquire dependencies from upstream sources, not Library or sandbox paths.
- [ ] Any offline mirror matches the exact pinned version and platform.
- [ ] Project-owned material is in English.

### Versioning

- [ ] The highest-impact change is identified.
- [ ] `VERSION`, `VersionPrefix`, app versions, and artifact names match.
- [ ] Contracts and schemas are classified.
- [ ] Changelog and release notes describe observable impact.
- [ ] Migration and rollback are documented when required.

### Publication

- [ ] Executed and unexecuted gates are separated.
- [ ] The final ZIP was extracted and revalidated.
- [ ] The manifest was verified.
- [ ] The checksum was calculated from the final artifact.
- [ ] Tag, images, ZIP, and documents use the same version.
- [ ] The external immutable release entry is complete.
- [ ] External release documents match the ZIP copies.
- [ ] Product source contains no private offline-mirror or sandbox dependency path.
- [ ] Missing offline mirrors are reported as blockers rather than replaced with nearby versions.
- [ ] No published artifact was replaced.

## 20. Offline sandbox and shared dependency policy

Offline qualification is separate from normal dependency acquisition. Private archive paths and host-specific staging directories are never part of the source repository contract.

### 20.1 Storage and materialization boundary

1. Materialize the exact release archive and dependency mirrors into a clean, writable workspace before validation.
2. Local extraction, build, or test does not modify the original immutable archive.
3. Use isolated caches and record toolchain, package, and artifact identities.
4. Offline mirrors are validation inputs only and are never committed as package feeds or used as runtime dependencies.

### 20.2 Shared .NET SDK

1. Match the exact SDK pinned in `global.json`.
2. A local SDK may be selected through `DOTNET_ROOT` and `PATH` without global installation.
3. Record the actual selected SDK and environment in `VALIDATION.md`.

### 20.3 Shared NuGet repository

Use a shared, integrity-verified offline package mirror when online restore is unavailable. Keep exact package IDs and versions, manifests, and checksums; do not duplicate package binaries into release-specific feeds. Use an explicit offline NuGet configuration that clears online package and audit sources. Do not claim offline restore if any undeclared remote source was used. Missing exact versions are blocked gates, not grounds to substitute nearby versions.

### 20.4 Docker-first dependency acquisition

1. RUNE Dockerfiles and build-time scripts are the normal dependency acquisition path.
2. Base images must use immutable or explicitly pinned version tags from authoritative publishers.
3. JavaScript packages should use authoritative package-registry artifacts as the primary source. Public CDNs may be retained only as explicit fallbacks with documented rationale and integrity validation.
4. Browser installation, operating-system packages, Python packages, and other build dependencies must be acquired during image build from their declared upstream source.
5. Runtime document rendering must not require external network access after the image has been built.
6. Dockerfiles, Compose files, source code, and runtime configuration must not reference private offline-mirror or temporary sandbox paths.
7. A Docker build that works only after injecting a private archive file is not the normal supported build and must be reported as an offline validation adaptation.

### 20.5 Offline mirror identity and pin parity

1. An offline mirror may replace only the network transfer step in an isolated sandbox.
2. The mirrored filename, semantic version, platform, architecture, package metadata, and expected license material must match the release pin.
3. Checksums or detached signatures must be verified when available.
4. A lower, higher, renamed, or manually reconstructed version is not equivalent evidence.
5. A missing exact version is a blocked gate and must be recorded in the runbook, `LAST_VERSION` limitations, and release-specific validation when relevant.
6. Presence of an archive is not execution evidence; the real renderer, server, browser, or validator workflow must still run.
7. veraPDF and Java are external independent-validation tooling only; they are not RUNE build, API, worker, renderer, Docker image, or runtime dependencies unless a separately approved architecture explicitly changes that boundary.
8. The immutable RUNE `0.5.0` source audit found no veraPDF, Java, JRE, Temurin, OpenJDK, `JAVA_HOME`, `java -jar`, or JAR-execution references in source code, project/dependency manifests, scripts, Dockerfiles, Compose, or runtime configuration.
9. RUNE PDF/A generation depends on Ghostscript and an sRGB ICC profile. Independent veraPDF validation is a separate post-generation qualification gate and must not be represented as required for PDF/A generation.
10. Any future accidental veraPDF or Java product dependency requires a corrective release to remove it; immutable published releases must not be edited in place.
11. Offline NATS validation must use the exact server version pinned by the RUNE Dockerfile or an explicitly approved version change in a new RUNE release.

### 20.6 Offline qualification

A release may claim the `source-build-automated-tests-and-local-api-smoke` qualification only when a clean materialized sandbox has executed:

1. workspace validation;
2. checksum and internal package-manifest verification;
3. offline restore using the shared NuGet repository;
4. Release build of the aggregate solution;
5. all automated .NET tests;
6. applicable Python and TypeScript tests;
7. schema, catalog, and functional-reference validation;
8. a local API smoke test from compiled output.

Browser exports, NATS/JetStream, Docker, independent PDF/A conformance, and production promotion remain separate gates and must not be inferred from this qualification.

## 21. Latest functional version pointer

The external immutable release archive may maintain `LAST_VERSION.json` as its machine-readable functional release-selection pointer and `LAST_VERSION.md` as its human-readable companion. The repository uses `VERSION` for the source version and immutable Git tags for qualified published releases. Source commits do not update archive promotion status.

Rules:

1. automated release-archive consumers must read `LAST_VERSION.json` before selecting an archived release;
2. folder-name sorting alone is not a valid version-selection mechanism;
3. `latestFunctional` must reference a non-withdrawn immutable release that passed the qualification named in the file;
4. the pointer must contain exact folder, archive, checksum, validation, environment, and limitation information;
5. `operationalPromotionApproved=false` must be preserved until all declared operational gates pass;
6. `latestOperationallyPromoted` must remain `null` when no release has completed operational promotion;
7. withdrawn releases must remain listed with their replacement and notice path;
8. the pointer is updated only after the candidate release and its archive entry have been verified;
9. updating the pointer does not modify or replace the referenced release artifact;
10. a pointer correction must preserve auditability and must not conceal a withdrawn or failed release.
11. `latestCandidate`, when present, must identify a verified immutable candidate folder and must list every promotion gate still open; it never overrides `latestFunctional`.

## 22. RUNE 0.5 compatibility and evidence policy

Starting with RUNE 0.5.0:

1. the exact Markdown PDF Studio 1.8.7 canonical feature fixture is preserved and verified using SHA-256 `3e2ff87fbfc4814b6b502e13e1ce426c342adde4e7fa93e4c0bd9180ee9950e3`;
2. the 38 canonical cases and reference minor-syntax regressions are independent mandatory gates;
3. browser-output claims require a real Chromium execution with the browser test flag enabled;
4. PDF/A claims require a real Ghostscript conversion using an available ICC profile;
5. external release folders must contain the source ZIP and release evidence only; expanded source trees are prohibited;
6. source ZIPs must use one `RUNE/` archive root, exclude generated artifacts, and pass clean-extraction manifest validation;
7. live NATS, Docker, Compose, and supply-chain results must remain explicitly unverified when those runtimes are unavailable;
8. `LAST_VERSION.json` may name 0.5.0 as latest functional while `operationalPromotionApproved` remains false;
9. the NATS validation executable must match the Dockerfile pin `2.14.3`; the exact `2.14.3` Linux AMD64 archive is verified in the governed offline mirror, while `2.14.1` remains historical and non-qualifying for that pin;
10. Mermaid `11.16.0`, KaTeX `0.18.1`, SchemaTex `1.0.1`, Temurin `21.0.10+7`, and veraPDF `1.30.2` offline artifacts may be used only as sandbox mirrors;
11. the RUNE `0.5.0` Mermaid and SchemaTex downloaders use public CDN endpoints rather than primary npm tarballs; this is recorded current behavior and must not be misrepresented as direct primary-registry acquisition;
12. a future release that changes web-asset acquisition should use authoritative npm tarballs as the primary source, preserve licenses and metadata, and validate deterministic extraction and digest identity.

