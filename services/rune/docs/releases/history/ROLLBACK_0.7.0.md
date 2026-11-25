# RUNE 0.7.0 rollback

The supported source rollback target is immutable RUNE 0.6.0.

Before rollback:

1. stop accepting new jobs;
2. allow local or NATS processors to finish, or retain the persisted data root;
3. identify queued PDF jobs because RUNE 0.6.0 cannot process PDF render packages;
4. archive 0.7.0 PDF packages, HTML results, and conversion reports;
5. deploy the exact RUNE 0.6.0 artifact and matching configuration.

Markdown/HTML jobs using render package contract `1.0` may be processed after rollback. PDF jobs using contract `1.1` require roll-forward to 0.7.0 or later and must not be submitted to a 0.6.0 worker.
