# PDF link preservation

## Status

Implemented for PDF-to-HTML in RUNE 0.8.0 and extended to native PDF page import in RUNE 0.16.0 and retained in the integrated RUNE 0.17.0 line.

## PDF-to-HTML behavior

When `pdfImport.preserveLinks` is true, URI link annotations are extracted and emitted as safe HTML anchors. Per-page `linkCount` is recorded in `conversion-report.json`.

## Native-page behavior

When `pdfImport.mode` is `native-page` and `annotations.links` is `preserve`, RUNE removes every source annotation and reconstructs only bounded URI link rectangles in the imported output page. Only absolute `http`, `https`, and `mailto` targets are accepted. Internal destinations, launch actions, JavaScript actions, malformed rectangles, unsafe schemes, comments, widgets, and file attachments are not copied.

The final `pdf-import-manifest.json` records `preservedLinkCount` for each imported page.
