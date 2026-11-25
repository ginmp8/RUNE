# Testing

## Complete validation

```bash
./scripts/test.sh
```

On a Docker-capable host with package access, this validates structure, schemas, feature catalog, reference equivalence, Python clients, TypeScript contracts, .NET projects, Docker images, browser tests, Compose startup, API flows, NATS/worker processing, readiness timeout, idempotency, cancellation, retry, SSE, declared outputs, and the complete Studio React Flow pipeline.

## Package-free .NET validation

```bash
dotnet run --project services/rune/tools/Rune.Validation/Rune.Validation.csproj -c Release
```

This executable validates semantic contracts, options, synchronous client behavior, ownership analysis, React Flow parsing and security, legacy schema migration, complex example inventory, concurrent idempotency, leases, cancellation, retry, and retention without external NuGet packages.

## Reference equivalence

```bash
python3 services/rune/tools/validate_reference_equivalence.py
```

The validator requires every case in the exact 1.8.7 reference fixture to map to one project-owned executable RUNE case.

## Browser recovery gates

```bash
python3 scripts/verify_recovery_runtime.py
python3 scripts/verify_studio_pipeline.py --api-url http://localhost:8080
```

The first validates the exact distributed local renderer and creates a PDF. The second validates the complete API-to-browser pipeline. Both require a compatible Chromium executable.

## Browser tests

Browser xUnit tests run only when `RUNE_RUN_BROWSER_TESTS=1`. The worker Dockerfile includes a `browser-test` stage with Playwright, Chromium, Ghostscript, and ICC profiles.

## Evidence discipline

A static validator pass does not prove browser output, NATS delivery, Docker startup, PDF/A conformance, or production operation. `VALIDATION.md` records each gate independently as executed, static, not executed, or blocked.

## Native PDF import qualification

The retained corpus under `services/rune/tests/fixtures/pdf-native` covers simple pages, subset fonts, Type 3 fonts, alpha/transparency, vectors, mixed page dimensions, rotations, links, forms, signatures, annotations, object-stream variants, and multiple producer identities. Automated tests must compare page count, boxes, dimensions, rotation, extracted text, link targets, native/fallback decision, and output size. Pixel and font comparisons are part of the real Chromium qualification gate rather than unit-only evidence.

A release must not claim native PDF operational promotion until the complete API -> queue -> Worker -> Chromium -> native composer path has executed against the corpus and unsupported inputs produce an explicit visual fallback or controlled rejection.

## Distributed resilience qualification

Static contract validation is package-free:

```bash
python3 scripts/verify_resilience_contract.py --root .
```

A Docker-capable host can execute the two-node recovery suite:

```bash
python3 scripts/verify_multi_node_resilience.py \
  --output build/resilience/multi-node
```

Bounded workload profiles are separate so duration and resource cost remain explicit:

```bash
python3 scripts/run_resilience_load.py --profile smoke --output build/resilience/smoke.json
python3 scripts/run_resilience_load.py --profile load --jobs 500 --output build/resilience/load.json
python3 scripts/run_resilience_load.py --profile sustained --duration-minutes 60 --output build/resilience/sustained.json
python3 scripts/run_resilience_load.py --profile soak --duration-minutes 120 --output build/resilience/soak.json
```

The live suite must be evaluated together with `/metrics`, Compose logs, Docker resource snapshots, temporary-file sizes, cache growth, and JetStream consumer state. Static success does not satisfy these live gates.

## Per-scenario native PDF evidence

```bash
python3 scripts/generate_native_pdf_evidence.py --output build/evidence/native-pdf
```

The generator retains individual PDF/PDF-A outputs, `pdf-import-manifest.json`, `pdfinfo`, `pdftotext`, fallback reasons, JavaScript-removal evidence, and the stable HTTP 400 signature-rejection response.

## Independent PDF/A validation

```bash
python3 scripts/validate_verapdf.py --verapdf <verapdf> --pdf <artifact.pdf> --output <report.json>
```

Ghostscript generation and independent veraPDF conformance are separate gates. RUNE 0.18.0 retains reports for ordinary and native-composite PDF/A-2b.
