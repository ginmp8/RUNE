# Page Decoration Profiles

RUNE 0.18.0 normalizes page decorations from explicit API input, Markdown front matter, `rune-header`/`rune-footer` fences, and versioned theme defaults. Precedence is `API > front matter > fences > theme defaults`; ambiguous definitions at the same level fail closed.

Regions accept text, constrained Markdown, or constrained HTML. Local PNG, JPEG, WebP, and sanitized SVG resources are embedded without network access. Approved renderer fragments are pre-rendered once and reused. The plan records `direct`, `preRender`, or `rejected` capability classification and deterministic parser, sanitizer, resource, font, theme, and renderer provenance.

Built-in tokens include page number, total pages, title, document name, render date, section title, and allowlisted metadata. Selectors cover cover, first, default, left, right, named sections, exact pages, and ranges. Physical rules resolve by priority, specificity, and stable identity.

Chromium creates the base PDF, RUNE resolves physical pages, validates reserved margins and late token growth, measures `maxHeight`/`minScale`, and applies overlays in a second pass. Legal and archival profiles default to `overflow=error`; failure or cancellation publishes no completed artifact. Tagged-PDF semantics must be preserved or the job fails. PDF/A validation occurs only after final decoration.
