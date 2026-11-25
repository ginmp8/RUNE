# SchemaTex And Orgchart

RUNE 0.18.0 embeds the unmodified official `schematex` npm package version 1.0.1. The retained package tarball is pinned by SHA-256 and SHA-512, mapped to upstream commit `cee9e7b61e8145c41f3793e41e7e33637105484b`, and distributed with its AGPL-3.0-only license and source record.

The API and Worker load the same verified `package/dist/index.js` bytes through a restricted local Node.js process. Startup and render qualification require the official `render`, `renderPreview`, and `renderResult` exports. Runtime CDN or network acquisition is disabled.

Generic `schematex` fences and the `orgchart` alias pass the upstream DSL without private translation. Malformed input fails closed with retained upstream diagnostics. Successful SVG is size-bounded and sanitized before insertion. Availability, version, digest, source, and license are exposed through feature discovery and SBOM metadata.
