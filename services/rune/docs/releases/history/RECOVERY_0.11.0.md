# RUNE 0.11.0 Recovery

RUNE `0.11.0` is derived from the qualified `0.10.0` source archive and adds bounded document-generation capabilities without altering the persisted job-state contract.

Recovery sequence:

1. restore the complete immutable `0.11.0` package;
2. verify `MANIFEST.sha256`;
3. restore with the pinned SDK and package sources;
4. run workspace validation, build, and automated tests;
5. run browser/API evidence for the enabled features;
6. clear only corrupt cache entries identified by digest validation.

Direct source overlay on a published release is prohibited.
