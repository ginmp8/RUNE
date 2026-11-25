# RUNE API

## Discovery

- `GET /`: product identity and links.
- `GET /health`: health status.
- `GET /metrics`: Prometheus resilience metrics aggregated from shared job and operational state.
- `GET /v1/features`: input, output, renderer, and execution-mode discovery.
- `GET /v1/openapi.json`: OpenAPI 3.1 document.
- `GET /v1/schemas`: published schema names.
- `GET /v1/schemas/{name}`: a published JSON schema.

## Rendering

`POST /v1/render` accepts `render-request.v1.schema.json`.

Synchronous outputs return `200`:

- `interactiveHtml`
- `structuredJson`

Browser-backed outputs and PDF-to-HTML conversion return `202` with a render identifier:

- `staticHtml`
- `pdf`
- `pdfA`
- `png`
- `jpeg`
- `svg`
- PDF input with `staticHtml` output

`waitForCompletion` may keep the initial request open for a bounded number of seconds. When the result is not ready, the API still returns `202` and processing continues.

## Jobs

- `GET /v1/renders`: paginated filtering by status and creation dates (for example, `?status=completed&offset=0&limit=5`). Status names are case-insensitive; omitted or empty status means no status filter, and an invalid state returns HTTP 400 with `invalid-render-status`.
- `GET /v1/renders/{id}`: status, progress, attempts, lease, and result availability.
- `GET /v1/renders/{id}/content`: range-enabled result download.
- `GET /v1/renders/{id}/conversion-report`: PDF conversion evidence and per-page strategy.
- `GET /v1/renders/{id}/events`: Server-Sent Events status stream.
- `POST /v1/renders/{id}/cancel`: queued or running cancellation.
- `POST /v1/renders/{id}/retry`: requeue failed or cancelled work.
- `GET /v1/dead-letters`: list jobs with explicit terminal dead-letter state.
- `POST /v1/renders/{id}/replay`: clear dead-letter state, create a new durable dispatch generation, and republish.

Render acceptance persists command-publication intent before the selected dispatcher is called. A stopped API therefore cannot silently strand an accepted job between filesystem commit and broker publication. See [Durable dispatch, dead letter, and replay](operations/durable-dispatch-and-dead-letter.md).

## Current scope

Authentication, authorization, and rate limiting remain deployment-boundary controls. Deployments that expose RUNE outside a trusted environment must add those controls at the platform boundary.

## Advanced document operations

- `sourceType: composite` assembles ordered Markdown, HTML, and template parts.
- `POST /v1/artifacts/compare` compares two base64 artifacts and returns digest, semantic, metadata, and bounded byte-difference evidence.
- `outputFormats` selects two or more outputs for one shared-storage atomic artifact-set transaction.
- Physical-page, range, section, and parity decorations require `options.pageDecorations.twoPassPdfComposition=true`.

## Native PDF page import

Composite PDF parts may set `pdfImport.mode` to `native-page`. The mode is accepted only for final PDF or PDF/A composition and preserves supported source-page object graphs instead of first converting them to HTML. Policy fields are `signatures`, `forms`, `annotations.links`, `annotations.comments`, `annotations.attachments`, `javascript`, and `fallback`.

Successful native planning publishes `pdf-import-manifest.json` as a side artifact. The public schemas are `pdf-import-options.v1.schema.json` and `pdf-import-manifest.v1.schema.json`. Direct PDF-to-HTML requests that ask for `native-page` explicitly use visual fallback and report it in `conversion-report.json`.

Native-PDF policy failures return HTTP 400 with their stable domain code, including `pdf-signature-rejected`, `pdf-form-rejected`, `pdf-javascript-rejected`, and `pdf-native-fallback-rejected`. They are not reported as generic internal server errors.
