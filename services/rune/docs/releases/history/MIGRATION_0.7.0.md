# Migration to RUNE 0.7.0

## Required action

Replace the complete extracted RUNE 0.6.0 source tree with the 0.7.0 package and rebuild all applications and SDKs. Do not overlay individual files onto a prior release.

## Dispatcher selection

Existing deployments preserve the `nats` provider by default. To run without NATS, set:

```text
RUNE_DISPATCH_PROVIDER=local
```

Provider selection is explicit. Unsupported values fail startup and there is no automatic fallback.

## Contract compatibility

Existing Markdown/HTML requests and render packages remain supported. PDF requests use additive request fields and render package contract `1.1`. Strict clients that reject unknown response fields must be updated to tolerate the additive `conversionReportPath` job field and additional feature-discovery fields.

## PDF input

PDF input supports only `staticHtml` output in this release. OCR, encrypted PDFs, extracted links, and standalone image extraction are not supported.
