# RUNE 0.8.0 rollback

The source rollback target is immutable RUNE 0.7.0. Before rollback, drain local jobs and ensure no queued PDF request depends on password support, OCR, extracted artifacts, or conversion-report payload `1.1`. Distributed deployments must restore their prior explicit NATS configuration.
