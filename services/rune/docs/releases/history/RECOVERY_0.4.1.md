# RUNE 0.4.1 recovery record

## Lineage

- Predecessor source: immutable RUNE 0.4.0.
- Functional reference: Markdown PDF Studio 1.8.7.
- Recovery behavior: deterministic local React Flow SVG renderer retained from 0.4.0.
- Replacement status: 0.4.1 supersedes 0.4.0 for build, test, and promotion purposes.

## Reason for the patch

Local offline validation of 0.4.0 exposed release-blocking defects:

- invalid C# escaping in the API schema route;
- an API project SDK that did not provide web implicit imports;
- missing worker hosting imports;
- missing xUnit global imports in four test projects;
- generated build directories incorrectly treated as source-tree violations;
- incomplete keyboard and definition-list compatibility behavior;
- missing semantic diagram markers in the structured document model;
- shared renderer assets not copied into local API output;
- compatibility assertions that inspected the complete self-contained runtime instead of the sanitized user-content boundary.

## Retained recovery contract

RUNE 0.4.1 retains the 0.4.0 React Flow recovery contract:

- declarative and bounded JSON input;
- local deterministic SVG rendering;
- unique per-diagram marker identifiers;
- no withdrawn React/UMD runtime chain;
- three complex recovery fixtures totaling 72 nodes and 82 edges;
- readiness, browser, PDF, and Studio/API recovery gates where the environment supports them.

## Promotion rule

Do not promote RUNE 0.4.0. Promote only the 0.4.1 artifact after the applicable gates in `VALIDATION.md` pass in the target environment.
