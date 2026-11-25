# Content Addressed Render Cache

Fingerprint v3 covers source, resources, normalized options, runtime and renderer identity, fonts, templates, composites, security scope, PDF/A policy, and the canonical output set. Policies are `bypass`, `read`, `write`, `use`, and `refresh`.

The supported distributed store is a coherent shared filesystem/volume using atomic rename plus lease and fencing semantics. Hits recheck authorization and security labels before returning content. Sensitive entries require AES-GCM encryption through `RUNE_CACHE_ENCRYPTION_KEY`; cross-tenant existence information is not exposed.

Entries are immutable, retention-bounded, manifest- and digest-validated, and quarantined on corruption. Refresh failure preserves the prior valid entry. Cancellation distinguishes shared source work from individual waiters. Stale leases, expiry, eviction, administrative invalidation, and incident reasons are recorded in metadata and metrics.
