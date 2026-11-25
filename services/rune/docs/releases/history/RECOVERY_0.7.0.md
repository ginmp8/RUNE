# RUNE 0.7.0 recovery

RUNE 0.7.0 extends immutable RUNE 0.6.0. It preserves the Markdown PDF Studio 1.8.7 compatibility baseline and adds PDF import plus local dispatch.

## Recovery lineage

- source baseline: RUNE 0.6.0;
- functional reference: Markdown PDF Studio 1.8.7 for existing Markdown/rendering behavior;
- new PDF engines: PdfLexer 0.1.27 and Docnet.Core/PDFium 2.6.0;
- rollback target: RUNE 0.6.0;
- withdrawn releases remain governed by the existing release history.

## Recovery behavior

The local dispatcher reconstructs in-memory work from persisted queued jobs and expired claimed/rendering leases at startup. A shutdown that cannot drain within the configured timeout leaves persisted jobs recoverable on the next start.
