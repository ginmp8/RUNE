# RUNE 0.13.0 Implementation Report

## Decision

RUNE 0.13.0 extends the qualified 0.12.0 line. The requested `01.00.00` identity was not used because RUNE governance defines `1.0.0` as a stable-contract and operational-readiness promise, and the remaining Docker, multi-node failure, advisory, signing, transparency, and production gates have not all passed.

## Implemented

### Physical font optimization and validation

- Added WOFF, WOFF2, TrueType, and OpenType introspection through a bundled FontTools utility.
- Added content-addressed validation and subset caches with validator, policy, subsetter, glyph-set, format, and options identities.
- Added deterministic sanitization and physical subsetting with atomic publication.
- Preserved nonblocking `auto` behavior: a cache miss renders with the original or sanitized font and may schedule bounded process-local generation for a later request.
- Added fail-closed `physical` mode when reduced bytes are mandatory.

### Advanced artifact comparison

- Added optional multipage raster comparison with configurable graphical tolerance and differing-page reporting.
- Added optional PNG diff-image output.
- Added optional multipage Tesseract OCR comparison with normalized text similarity.
- Added bounded PDF-object canonicalization with ignored volatile metadata and explicit unsupported-form limitations.

### Composite document assembly

- Added recursively bounded nested composites.
- Added independent per-part page size, orientation, and margins through named `@page` rules.
- Added bounded visual or semantic PDF import as a composite part.
- Added deterministic heading-ID and internal-link rewriting.
- Added optional generated table-of-contents rewriting from the final composite heading set.

### Template helpers

- Added caller-defined declarative helper pipelines.
- Added bounded upper/lower/trim/prefix/suffix/replace/regular-expression/default/substring operations.
- Preserved the prohibition on arbitrary executable helper code, process, filesystem, network, clock, random, and reflection access.

### Tagged PDF structure projection

- Added optional browser-side measurement of semantic sections and headings after renderer readiness.
- Added temporary start/end markers, mapping-PDF text extraction, marker removal, and a final clean PDF so mixed page sizes resolve to exact physical page ranges.
- Added atomic publication of `structure-map.json` beside PDF and PDF/A artifacts.
- Added dedicated SchemaTex entity-structure and orgchart browser coverage for this path.

### Shared cache coordination

- Replaced ambiguous open-or-create locking with exclusive-create fenced leases.
- Added owner tokens, machine/process identity, heartbeat renewal, stale quarantine, and owner-checked release.
- Added coherent exclusive-create, atomic rename, and delete semantic probes.
- Prevented a superseded lease from renewing or deleting a replacement lock.

## Corrected defects found during implementation

- Corrected ImageMagick metric parsing when the provider returns both absolute and normalized values.
- Corrected PDF visual and OCR comparison that previously considered only the first page in the new implementation.
- Corrected cache lease ownership races in heartbeat and release paths.
- Corrected partial-file publication risk in font sanitization, subsetting, and cache writes.
- Removed duplicate PDF-part validation in composite compilation.
- Corrected the initial mixed-page-size structure projection, which used proportional DOM height and assigned incorrect physical pages; temporary printed marker extraction now resolves exact ranges.
- Corrected the tagged-PDF test fixture so it validates sanitized semantic Markdown output rather than raw HTML intentionally removed by the sanitizer.

## Deliberately outside this release

- Native object-preserving PDF concatenation, digital-signature preservation, and direct PDF object-graph merging.
- PDF portfolios and arbitrary embedded-file collections.
- Arbitrary executable user helper code.
- Quorum, Raft, Paxos, distributed consensus, partition tolerance, or correctness on object stores without coherent filesystem semantics.
- Durable external low-priority font-subset queueing; automatic generation is process-local best effort.
- Complete PDF/UA validation or reconstruction of every internal tagged-PDF structure object; the structure map is a companion print-marker mapping artifact.
- Guaranteed semantic equality for encrypted PDFs, unsupported object streams, signatures, or every equivalent PDF encoding.
- Cross-provider two-phase commit.
- Docker/Compose, multi-node failure injection, load/soak, complete current advisory coverage, organization-trusted signing, transparency publication, and production promotion unless separately recorded as executed evidence.
