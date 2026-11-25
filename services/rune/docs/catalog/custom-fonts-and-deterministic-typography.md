# Custom Fonts And Deterministic Typography

RUNE supports request-scoped WOFF2, WOFF, TrueType, and OpenType faces. Resolution is deterministic across family, weight, style, stretch, and variable axes. `missingFacePolicy`, `missingGlyphPolicy`, `embedPolicy`, and `subsetPolicy` are explicit typed contracts.

The versioned `rune-deterministic-fonts-v1` fallback pack is built only from bundled, license-cleared bytes with recorded digests and Unicode coverage. Host font lookup and remote font acquisition are prohibited. Sanitized and subset byte identities participate in fingerprints and provenance.

Readiness waits for every required face, actual glyph use, renderer-created text, and stabilized layout. Missing faces, glyphs, timeout, embedding, subset, and ToUnicode failures produce deterministic diagnostics. PDF output records embedded font inventory and preserves font policy through diagrams, page decorations, composite assembly, multi-output, and PDF/A processing.
