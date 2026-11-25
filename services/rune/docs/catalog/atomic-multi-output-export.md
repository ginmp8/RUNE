# Atomic Multi Output Export

A request selects either `outputFormat` or `outputFormats`; providing both is invalid. The output set is deduplicated, canonically ordered, and serialized consistently across API, events, fingerprints, logs, CLI, Studio, and SDKs.

Publication options control atomic policy, package mode, artifact naming, and manifest inclusion. One template expansion and compilation feed all selected outputs, and browser intermediates are reused only when compatible. Public progress reports each output state and the failed output/stage.

The artifact-set manifest records stable names, content types, lengths, digests, validation, producer/validator identity, shared-intermediate digests, provenance, and derivation relationships. The API exposes set metadata, individual committed artifacts, and an optional bounded ZIP package. `/content` remains valid only for singular output jobs.

Naming tokens are allowlisted; collisions, traversal, invalid paths, and ZIP limit violations fail before commit. A job is complete only when the whole validated set is atomically visible.
