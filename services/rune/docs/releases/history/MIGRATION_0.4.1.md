# RUNE 0.4.1 migration

## Scope

RUNE 0.4.1 is a compatible patch correction for the 0.4 recovery line. It does not change HTTP schema majors, event subject versions, persisted render-job contracts, or supported output formats.

## Required action

1. Replace the complete extracted 0.4.0 source tree with the 0.4.1 package.
2. Do not copy `bin/`, `obj/`, caches, or generated files from the earlier extraction.
3. Restore packages from the approved NuGet source.
4. Rebuild `rune-api`, `rune-worker`, and all test projects.
5. Run the release validation commands before promotion.

## Source and build corrections

The API project now uses the ASP.NET Core Web SDK and copies shared schemas and renderer assets into local build output. The worker imports its required hosting abstractions explicitly. Test projects import xUnit consistently. No consumer code change is required.

## Markdown compatibility corrections

Keyboard syntax such as `++ctrl+c++` and definition-list syntax are now preserved by the safe Markdown pipeline. Mermaid and React Flow outputs expose semantic renderer markers used by the structured document model.

## Contract compatibility

No migration of stored jobs, queued NATS messages, API payloads, schemas, or generated artifacts is required. Existing 0.3.0 and 0.4.0 persisted state remains readable by 0.4.1 under the existing contract versions.
