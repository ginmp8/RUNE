# RUNE 0.5.0 rollback

## Supported target

The supported rollback target is the immutable RUNE 0.4.1 release.

## Procedure

1. Stop creation of new browser-render jobs.
2. Allow in-flight jobs to complete or cancel them through the existing API.
3. Deploy the 0.4.1 API, worker, and Studio artifacts together.
4. Keep the existing job and artifact volume; no state conversion is required.
5. Verify health, interactive HTML, job status, and one browser export.

## Compatibility note

Documents using syntax introduced in 0.5.0—CriticMarkup, progress bars, additional FancyList markers, `GH-123`, or alternate KaTeX delimiters—may render as literal source after rollback. Existing generated artifacts remain unchanged. Resubmit those documents after returning to 0.5.0.

## Data safety

The release does not introduce a persisted job-schema change, event-subject major change, or destructive migration. Rollback does not require deleting jobs or artifacts.
