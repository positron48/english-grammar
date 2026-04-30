# LLM Benchmark Summary

- Started at: `2026-04-29T08:29:41Z`

## Scenarios

| Scenario | Mode | Time (s) | Tasks ok/total | Questions total | Q/s |
|---|---:|---:|---:|---:|---:|
| `llamacpp-parallel4` | `parallel` | 36.335 | 0/4 | 0 | 0.0 |

## Per-task details

### llamacpp-parallel4

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 36.181 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t2` | 2/1 | 36.172 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t3` | 3/1 | 36.178 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t4` | 4/1 | 36.174 | 0 | fail | HTTP Error 500: Internal Server Error |

- Note: Параллельный клиентский запуск 4 задач одновременно.

