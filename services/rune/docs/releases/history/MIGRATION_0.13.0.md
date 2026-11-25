# Migration to RUNE 0.13.0

RUNE 0.13.0 is an additive pre-1.0 capability release. Existing 0.12.0 requests remain valid and all new request fields are optional.

New clients may opt into:

- `advanced` options on `POST /v1/artifacts/compare` for pixel, OCR, diff-image, and PDF canonical comparison;
- nested `composite` parts, `pdf` parts, per-part page size/orientation/margins, `rewriteTableOfContents`, and `maximumDepth`;
- caller-defined declarative `customHelpers` in `rune-template-v1`;
- physical font subset and sanitization policies;
- `renderOptions.emitStructureMap` for PDF and PDF/A companion artifacts;
- shared-cache storage-semantic probing and fenced lease settings.

Operators using advanced comparison must install the provider binaries declared by the API image: ImageMagick, Poppler `pdftoppm`, and Tesseract. Operators using font sanitization or physical subsetting must retain Python, FontTools, and WOFF2/Brotli support in the API image.

No persisted-data migration is required. Shared cache roots must still provide coherent exclusive-create, atomic rename, and delete semantics. The new probe detects unsupported semantics but does not convert an object store into a coherent filesystem.
