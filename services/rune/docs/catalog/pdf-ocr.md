# PDF OCR

## Status

Implemented in RUNE 0.8.0.

## Behavior

PDF import supports `ocrMode` values `off`, `auto`, and `force`. `auto` invokes OCR only when the text-layer confidence is below the configured threshold. `force` invokes OCR for every page. The default remains `off`.

The qualified provider is Tesseract. `RUNE_TESSERACT_PATH` may select a compatible executable, and `ocrLanguage` selects installed language data using a bounded identifier. OCR output is emitted as searchable text together with the source page image. Missing providers and empty OCR results fail with stable codes.

## Validation

Unit tests use a deterministic provider boundary. API evidence additionally executes the installed Tesseract binary against a rasterized PDF page.
