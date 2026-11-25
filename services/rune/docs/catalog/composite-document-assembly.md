# Composite Document Assembly

Composite input supports explicit `logical`, `rendered`, `hybrid`, and deterministic `auto` modes over typed Markdown, HTML, template, prior RUNE artifact, and bounded PDF parts.

Every part has stable identity, digest, trust, section, page, label, numbering, size, orientation, decoration, and preservation options. Root-only, inheritable, and part-local option classes reject ambiguity. Stable part/anchor identities drive cross-part references, global TOC, outline, heading numbering, page labels, numbering restart, and total-page tokens.

The assembly manifest records each part digest, resolved option, preservation decision, cross-reference, diagnostic, and final artifact identity. PDF boxes, rotation, links, destinations, outline, labels, metadata, tags, reading order, fonts, profiles, annotations, forms, attachments, signatures, encryption, and PDF/A are either preserved according to declared policy or cause terminal failure.

Final decorations, selected outputs, and PDF/A processing occur only after complete assembly. Failure or cancellation publishes no partial completed artifact.
