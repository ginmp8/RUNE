# Universal Minor Compatibility

**Category:** Compatibility  
**Status:** implemented

## Purpose

Closes the Markdown PDF Studio 1.8.7 minor-syntax compatibility gap that is not represented as independent canonical feature cases:

- CriticMarkup additions, deletions, substitutions, highlights, and comments;
- progress bars using `[=75% "Label"]`;
- ordered FancyList markers such as `1)`, letters, Roman numerals, and `#.`;
- smart symbols such as `(tm)`, `(c)`, `(r)`, `+/-`, arrows, and not-equal;
- GitHub `GH-123` references in the existing opt-in mode;
- KaTeX delimiters `\(...\)` and `\[...\]` in addition to dollar delimiters;
- semantic safe HTML for `picture`, `source[srcset]`, `progress`, `meter`, ruby, `samp`, and `var`;
- a CSS property allowlist that rejects positioning and active event attributes.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Markdown/MarkdownCompatibilityNormalizer.cs`
- Security: `services/rune/src/engine/Rune.Security/HtmlContentSanitizer.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/ReferenceMinorCompatibilityTests.cs`
- Reference: Markdown PDF Studio `1.8.7`

## Contract

Transformations are performed outside fenced and inline code. The generated HTML remains subject to the same sanitizer and self-contained rendering pipeline as the rest of RUNE.
