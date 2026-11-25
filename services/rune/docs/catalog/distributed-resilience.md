# Distributed Resilience

RUNE supports a qualification topology with two APIs, two Workers, NATS JetStream, shared job/artifact storage, and shared cache. Job claims receive monotonic fencing tokens, and every Worker publication path verifies current ownership.

See [Distributed resilience](../operations/distributed-resilience.md), [Failure injection](../operations/failure-injection.md), and [Resilience load and soak profiles](../operations/resilience-load-and-soak.md).
