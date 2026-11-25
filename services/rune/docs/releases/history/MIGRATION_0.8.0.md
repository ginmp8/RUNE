# Migration to RUNE 0.8.0

- Replace the complete 0.7.0 tree.
- Set `RUNE_DISPATCH_PROVIDER=nats` explicitly when distributed messaging is required; local is now the default.
- Allow conversion-report schema payload `1.1` fields.
- Treat `pdfImport.password` as a secret and do not persist request payloads containing it.
- Install the requested Tesseract language data before enabling OCR.
