# RUNE 0.11.0 Rollback

Rollback target: RUNE `0.10.0`.

Replace the complete `0.11.0` deployment with the immutable `0.10.0` artifact. Do not overlay source trees. Requests using template input, typed fonts, cache policy, structured decoration regions, or `outputFormats` must be stopped or translated to the older contract before rollback.

Cached entries are derived artifacts and may be deleted after rollback. Existing completed render artifacts remain readable according to their retention policy.
