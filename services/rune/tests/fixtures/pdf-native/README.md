# Native PDF import corpus

This retained corpus exercises bounded native-page import and fallback policy behavior. `corpus.json` declares each fixture producer, coverage, expected outcome, and comparison dimensions.

The generated set covers simple PDFs, subset TrueType fonts, Type 3 fonts, alpha images, transparency, vectors, rotation, mixed page dimensions, URI links, forms, signatures, comments, attachments, JavaScript, PDF 1.5 object streams, and files from ReportLab, pypdf, Ghostscript, and the deterministic RUNE fixture writers.

Regenerate in an isolated validation environment with:

```bash
python3 services/rune/tests/fixtures/pdf-native/generate_corpus.py
```

The generator requires Python 3, ReportLab, Pillow, pypdf, and Ghostscript. These are corpus-authoring tools, not RUNE runtime dependencies. Published fixture bytes are retained in the source package so normal builds and tests do not require those tools.

Qualification compares pixels, extracted text, page count, dimensions and boxes, rotation, links, output size, fonts, applied mode, and fallback reason. Unit tests prove parser and policy behavior. Real Chromium pixel and composite-output comparisons remain a promotion gate.
