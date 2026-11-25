# Compatibility fixtures

`reference-feature-cases.1.8.7.json` is the exact feature inventory copied from the materialized Markdown PDF Studio 1.8.7 reference. It is retained as upstream evidence and may remain in the source language of that reference.

`reference-feature-cases.json` is the project-owned English RUNE inventory. It maps all 38 reference cases to RUNE implementation and tests.

Validation layers:

1. `validate_reference_equivalence.py` requires a complete 38-to-38 mapping;
2. `Rune.Engine.Tests/CompatibilityTests.cs` executes the project-owned cases when NuGet restore is available;
3. `Rune.Validation` executes package-free semantic checks, including React Flow parser security and the 3-document/72-node/82-edge inventory;
4. browser recovery scripts validate the exact distributed renderer, DOM result, marker uniqueness, and PDF when Chromium is available.

A catalog entry cannot claim implementation without documentation, an owning implementation path, and a test path.
