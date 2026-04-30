# LLM Benchmark Summary

- Started at: `2026-04-29T07:13:34Z`

## Scenarios

| Scenario | Mode | Time (s) | Tasks ok/total | Questions total | Q/s |
|---|---:|---:|---:|---:|---:|
| `ollama-seq` | `sequential` | 409.311 | 4/4 | 40 | 0.098 |
| `llamacpp-seq` | `sequential` | 16.507 | 0/4 | 0 | 0.0 |
| `llamacpp-speculative-seq` | `sequential` | 0.136 | 0/4 | 0 | 0.0 |
| `llamacpp-parallel4` | `parallel` | 6.181 | 0/4 | 0 | 0.0 |

## Per-task details

### ollama-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 104.57 | 10 | ok |  |
| `t2` | 2/1 | 97.002 | 10 | ok |  |
| `t3` | 3/1 | 88.692 | 10 | ok |  |
| `t4` | 4/1 | 118.755 | 10 | ok |  |

- Note: Базовый последовательный режим через Ollama.

### llamacpp-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 6.241 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t2` | 2/1 | 3.465 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t3` | 3/1 | 3.323 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t4` | 4/1 | 3.268 | 0 | fail | HTTP Error 500: Internal Server Error |

- Note: Базовый последовательный режим через llama.cpp OpenAI-compatible endpoint.

### llamacpp-speculative-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 0.0 | 0 | fail | <urlopen error [Errno 61] Connection refused> |
| `t2` | 2/1 | 0.0 | 0 | fail | <urlopen error [Errno 61] Connection refused> |
| `t3` | 3/1 | 0.0 | 0 | fail | <urlopen error [Errno 61] Connection refused> |
| `t4` | 4/1 | 0.0 | 0 | fail | <urlopen error [Errno 61] Connection refused> |

- Note: Запускайте отдельный llama-server с включенным speculative decoding на порту 8081.

### llamacpp-parallel4

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 6.054 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t2` | 2/1 | 6.06 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t3` | 3/1 | 6.053 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t4` | 4/1 | 6.057 | 0 | fail | HTTP Error 500: Internal Server Error |

- Note: Параллельный клиентский запуск 4 задач одновременно.

