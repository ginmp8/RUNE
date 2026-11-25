# RUNE 0.5.0 migration

## Scope

RUNE 0.5.0 is a compatible pre-1.0 minor release from 0.4.1. It adds Markdown PDF Studio 1.8.7 minor-syntax parity and strengthens browser/PDF-A validation without changing the HTTP API major, event subjects, persisted render-job shape, output-format identifiers, or storage layout.

## Required actions

1. Replace the complete extracted 0.4.1 source tree with `RUNE-0.5.0.zip`.
2. Rebuild API, worker, Studio, CLI, SDKs, and tests from the new source package.
3. Rebuild the worker image so the Playwright and Ghostscript changes are included.
4. Run the target-environment Docker, NATS, and Studio gates before promotion.

## New accepted source syntax

- CriticMarkup additions, deletions, substitutions, highlights, and comments;
- progress bars such as `[=75% "Delivery"]`;
- FancyList markers such as `1)`, `A)`, Roman numerals, and `#.`;
- GitHub `GH-123` references when GitHub references are enabled;
- KaTeX delimiters `\(...\)` and `\[...\]`;
- additional semantic safe HTML for progress, meter, ruby, samp, var, and picture source sets.

## Configuration

`RUNE_CHROMIUM_EXECUTABLE_PATH` may be used for local and CI validation with a system Chromium. It is optional in the worker container, which installs the Playwright-managed browser.

## State compatibility

No migration of stored jobs, packages, results, queued NATS messages, event schemas, or filesystem layout is required. Existing 0.4.1 state remains readable.
