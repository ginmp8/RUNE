# Resilience load and soak profiles

`scripts/run_resilience_load.py` submits browser jobs across both API nodes, waits for terminal states, reads Prometheus metrics, and writes one JSON report.

## Profiles

| Profile | Default work | Purpose |
|---|---:|---|
| `smoke` | 20 requests | topology and basic correctness |
| `load` | 200 requests | short queue and throughput observation |
| `sustained` | 30 minutes | bounded steady-state observation |
| `soak` | 120 minutes | short leak and degradation search |

Defaults can be overridden with `--jobs`, `--duration-minutes`, and `--concurrency`. A 2–4 hour soak is represented by `--profile soak --duration-minutes 120` through `240`.

## Commands

```bash
python3 scripts/run_resilience_load.py \
  --profile smoke \
  --output build/resilience/smoke.json

python3 scripts/run_resilience_load.py \
  --profile load \
  --jobs 500 \
  --output build/resilience/load.json

python3 scripts/run_resilience_load.py \
  --profile sustained \
  --duration-minutes 60 \
  --output build/resilience/sustained.json

python3 scripts/run_resilience_load.py \
  --profile soak \
  --duration-minutes 240 \
  --output build/resilience/soak.json
```

## Collected evidence

The report includes:

- submitted requests, unique jobs, and idempotent duplicates;
- completed, failed, cancelled, and timed-out jobs;
- jobs per minute;
- queue, render, and end-to-end p50, p95, and p99;
- attempts and retries;
- cache-hit and cache-miss job counts;
- all RUNE Prometheus metrics;
- Docker CPU and memory snapshots when Docker is available;
- per-Worker temporary-directory byte counts when they can be read.

## Soak review

A soak passes only after inspecting the report and service logs for:

- increasing memory after throughput stabilizes;
- nonzero Chromium count after the queue is empty;
- growing temporary-file count or byte size;
- unbounded cache growth outside configured quotas;
- consumers that stop making progress;
- declining jobs per minute without a workload change;
- repeated retries, fencing rejections, or lease conflicts without an injected fault.

This is intentionally a short qualification. Multi-day soak, hundreds of nodes, multi-region behavior, Raft, Paxos, and continuous chaos are outside RUNE 0.18.0.
