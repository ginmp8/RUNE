# RUNE 0.6.0 migration

RUNE 0.6.0 is a compatible pre-1.0 minor release from 0.5.0.

## Upgrade

1. Preserve the existing immutable `0.5.0` release artifact and checksum.
2. Replace the complete extracted source tree with `RUNE-0.6.0.zip`.
3. Restore, build, and test with the pinned .NET SDK and package versions.
4. Rebuild all deployed applications and SDK packages; do not mix 0.5.0 and 0.6.0 binaries.
5. Review `/v1/features` before enabling documents that require optional renderers.

## Compatibility

Existing render requests remain valid. `pageDecorations`, renderer capability records, and SSE `id`/`retry` fields are additive. Existing SSE clients that ignore unknown fields continue to work.

Legacy `headerTemplate` and `footerTemplate` remain supported. A request must not combine them with `pageDecorations`; such a request fails validation rather than producing ambiguous output.
