# Architecture

## Execution paths

```text
Markdown or HTML
  -> Rune.Api -> compiler -> synchronous HTML/model or immutable render package

PDF binary resource
  -> Rune.Api -> immutable PDF render package

asynchronous package
  -> explicit dispatcher provider
     -> local bounded channel -> shared RenderJobProcessor in Rune.Api
     -> NATS JetStream -> Rune.Worker -> shared RenderJobProcessor
        -> PDF import (PdfLexer + Docnet/PDFium) or Chromium export
        -> persisted result, conversion report, and lifecycle state
```

## Deployable units

- `Rune.Api`: HTTP composition root. It owns validation, compilation orchestration, job creation, status, result delivery, lifecycle endpoints, SSE, feature discovery, OpenAPI, and schemas.
- `Rune.Worker`: NATS composition root around the shared render-job processor. It owns distributed command consumption and retention cleanup.
- `rune-studio`: Streamlit API client. It never accesses NATS, the job volume, or the worker directly.
- Local dispatcher: in-process infrastructure hosted by the API for single-host operation.
- NATS server: environment infrastructure under `messaging/nats`, outside the rendering domain.

## Libraries

- `Rune.Core`: source and output enums, options, diagnostics, semantic document model, and compiler/renderer interfaces.
- `Rune.Markdown`: front matter, compatibility normalization, includes, data tables, diagram extraction, and Markdig compilation.
- `Rune.Html`: safe/trusted HTML handling and normalization.
- `Rune.Ownership`: ownership DSL, validation, graph analysis, cycles, roots, levels, and indirect ownership.
- `Rune.Rendering`: self-contained HTML, themes, assets, cover, TOC, headers, footers, watermark, and readiness integration.
- `Rune.Browser`: Playwright browser pool and browser output materialization.
- `Rune.Jobs`: atomic filesystem store, idempotency, querying, worker and publisher leases, durable dispatch intent, dead-letter state, cancellation, retry, companion artifacts, recovery, and retention.
- `Rune.Pdf`: bounded visual, semantic, and hybrid PDF-to-HTML conversion.
- `Rune.RenderProcessing`: transport-neutral job claiming, conversion/rendering, progress, retry, and artifact publication.
- `Rune.Dispatching.Local`: bounded local command transport, recovery, backpressure, health, and graceful drain.

## Dependency direction

```text
apps -> application -> engine/contracts/abstractions
sdk -> public contracts
Rune.Messaging.Nats -> messaging abstractions and event contracts
```

Concrete NATS types are forbidden under `services/rune/src`.

## Reliability model

- JetStream provides durable at-least-once command delivery in NATS mode. In local mode, the filesystem job store is durable and the bounded in-memory channel is recovered from persisted job state after restart.
- Render commands and handlers are idempotent by render identifier.
- Job creation and requeue persist a deterministic command outbox entry before publication. Expired publisher leases are reconciled by any API instance, and stale publishers are rejected by fencing tokens.
- Non-retryable deliveries enter explicit dead-letter state, publish a versioned terminal event, and can be replayed only through a new dispatch generation.
- The store uses atomic replacement and cross-process file locks.
- Workers claim jobs with renewable leases; expired leases permit recovery.
- A Chromium failure restarts the browser phase from the immutable render package.
- External browser network requests are blocked by default.
- Readiness timeout fails closed instead of returning an incomplete artifact.

## Native PDF composition boundary

Native PDF import is owned by the PDF import planner and PDF export layer, not by the Markdown compiler or Chromium renderer. `NativePdfImportPlanner` validates policy-sensitive source features and captures immutable page descriptors. `DocumentRenderApplication` emits exact-size deterministic placeholders. Chromium resolves their physical position inside the surrounding composite. `NativePdfPageComposer` then replaces those pages through PDFsharp import mode, strips annotations and page additional actions, and rebuilds only approved URI links. The Worker publishes `pdf-import-manifest.json` as evidence.

This boundary deliberately avoids turning RUNE into a mutable PDF editor. Visual and semantic import remain HTML conversion paths; native-page is a final-PDF composition path with explicit fallback.

## Distributed ownership and publication

The integrated 0.18.0 resilience profile runs two API processes and two Worker processes against one JetStream server and shared job, artifact, cache, temporary, and metric storage. It does not add a coordinator or consensus protocol.

A job claim increments a persisted monotonic fencing token. After claim, the Worker uses owner-aware operations for job state, primary results, side artifacts, PDF-conversion artifacts, and multi-output sets. Every operation validates the current Worker ID, fencing token, active lease, and terminal state before publication. A resumed process holding an old token cannot overwrite the replacement owner.

The render cache uses the same principle: a file lock supplies a token, a heartbeat keeps ownership live, and cache publication verifies the token immediately before atomic directory replacement. Results and cache entries are staged under unique temporary paths and become visible only after the final rename.

Operational counters and observations are persisted in shared storage and exposed by either API at `/metrics`. See `operations/distributed-resilience.md` for the complete guarantee and recovery model.

## Trace and telemetry boundary

API acceptance, durable publication, NATS consumption, and render processing propagate W3C trace context through event headers. The rendering domain exposes the stable `Rune` `ActivitySource` and `Meter`; deployments select and configure an OpenTelemetry-compatible exporter. See `operations/distributed-tracing.md`.
