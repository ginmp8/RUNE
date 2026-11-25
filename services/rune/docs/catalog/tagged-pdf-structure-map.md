# Tagged PDF Structure Map

When `renderOptions.emitStructureMap` is enabled for PDF or PDF/A, the browser waits for all document renderers and fonts, inserts temporary start/end markers around semantic DOM sections and headings, prints a mapping PDF, and extracts the physical page containing each marker.

The companion `structure-map.json` contains the source element identity, semantic kind, text label, DOM coordinates, exact start/end physical pages, mapping source, and fallback count. Nested composites, independent page sizes, and SchemaTex-heavy documents use the same print configuration as the final exported PDF. The render job processor persists the map beside the primary artifact and includes it in atomic multi-output publication.

This artifact provides a stable bridge from document semantics to physical pages. It does not rewrite the PDF object graph, reconstruct arbitrary reading order after generation, or claim full PDF/UA conformance. Chromium tagged-PDF support and independent accessibility validation remain separate concerns.
