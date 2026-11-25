# PDF To HTML Conversion

PDF-to-HTML is always a normal asynchronous render job over exactly one bounded PDF resource selected by `sourceResourcePath`.

Modes are independent:

- `visual` preserves page geometry through deterministic raster-backed HTML;
- `semantic` reconstructs headings, paragraphs, lists, tables, links, images, language, direction, and reading order where the provider can prove them;
- `hybrid` selects semantic or visual strategy per page region and records page, bounding box, reason, confidence, and provider identity for every fallback.

OCR policies are `off`, `auto`, and `force`. The conversion report distinguishes original and OCR-derived text and records provider/model/language/version/digest, confidence, losses, unsupported features, fallbacks, timings, sizes, warnings, and errors. Reconstructed content is explicitly marked as derived from PDF.

Encrypted or permission-restricted PDFs are rejected deterministically. Password-enabled input is not part of the 0.18.0 contract. Provider work is timeout-bounded, cancelable, non-root, no-network, and published atomically after cleanup and validation.
