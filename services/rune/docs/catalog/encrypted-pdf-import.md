# Encrypted PDF import

## Status

Implemented in RUNE 0.8.0.

## Behavior

`pdfImport.password` accepts a user or owner password without persisting it in the conversion report. PdfLexer and Docnet.Core receive the same password so semantic, visual, hybrid, and OCR paths can process protected input.

Missing or invalid passwords fail with `pdf-password-required`. The report records only the boolean `encrypted` state; it never records the supplied password.
