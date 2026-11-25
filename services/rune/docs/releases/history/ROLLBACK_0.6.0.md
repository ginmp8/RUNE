# RUNE 0.6.0 rollback

## Target

Roll back to the immutable RUNE `0.5.0` artifact and its recorded checksum.

## Procedure

1. Stop 0.6.0 API, worker, and Studio processes.
2. Preserve render-job data and generated artifacts before replacement.
3. Deploy the complete 0.5.0 artifact; do not copy selected files from either version.
4. Rebuild or restore the matching 0.5.0 applications and SDKs.
5. Run the 0.5.0 health and source/build/test qualification before reopening traffic.

## Impact

Requests using `pageDecorations` are not understood by 0.5.0 and must be removed before resubmission. SSE reconnection identifiers and renderer-capability details are unavailable after rollback. Existing completed artifacts remain unchanged.
