# RUNE 0.5.0 recovery record

## Baselines

- Previous immutable release: `RUNE-0.4.1.zip`.
- Functional reference: Markdown PDF Studio `1.8.7`.
- Canonical reference fixture SHA-256: `3e2ff87fbfc4814b6b502e13e1ce426c342adde4e7fa93e4c0bd9180ee9950e3`.

## Recovered compatibility

RUNE 0.5.0 closes minor compatibility behavior not isolated by the 38 canonical cases:

- CriticMarkup;
- progress bars;
- FancyLists;
- smart symbols;
- `GH-123` references;
- `\(...\)` and `\[...\]` math delimiters;
- semantic safe HTML and restricted CSS.

The exact 1.8.7 fixture is retained byte-for-byte and its digest is checked before the mapped suite executes.

## Browser recovery

- System Chromium can be selected using `RUNE_CHROMIUM_EXECUTABLE_PATH`.
- The deterministic static React Flow renderer keeps marker IDs unique across multiple diagrams.
- Browser tests execute static HTML, PDF, PDF/A, PNG, JPEG, SVG, and a two-diagram React Flow materialization.
- Ghostscript PDF/A conversion explicitly permits reading the selected ICC profile while retaining safer execution.

## Failure behavior

Renderer failures remain fail-closed. A browser artifact is not published until readiness passes. Worker retries restart from the immutable render package rather than attempting to resume a partial DOM.
