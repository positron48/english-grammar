# LLM Benchmark Summary

- Started at: `2026-04-29T07:59:37Z`

## Scenarios

| Scenario | Mode | Time (s) | Tasks ok/total | Questions total | Q/s |
|---|---:|---:|---:|---:|---:|
| `ollama-seq` | `sequential` | 395.778 | 4/4 | 40 | 0.101 |
| `llamacpp-seq` | `sequential` | 285.418 | 3/4 | 30 | 0.105 |
| `llamacpp-speculative-seq` | `sequential` | 877.048 | 1/4 | 10 | 0.011 |
| `llamacpp-parallel4` | `parallel` | 36.307 | 0/4 | 0 | 0.0 |

## Per-task details

### ollama-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 96.07 | 10 | ok |  |
| `t2` | 2/1 | 92.45 | 10 | ok |  |
| `t3` | 3/1 | 106.945 | 10 | ok |  |
| `t4` | 4/1 | 100.093 | 10 | ok |  |

- Note: Базовый последовательный режим через Ollama.

### llamacpp-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 96.65 | 0 | fail | json_parse_error: Unterminated string starting at: line 78 column 19 (char 3317) |
| `t2` | 2/1 | 52.757 | 10 | ok |  |
| `t3` | 3/1 | 61.2 | 10 | ok |  |
| `t4` | 4/1 | 74.618 | 10 | ok |  |

- Note: Базовый последовательный режим через llama.cpp OpenAI-compatible endpoint.

### llamacpp-speculative-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 354.688 | 10 | ok |  |
| `t2` | 2/1 | 521.331 | 0 | fail | json_parse_error: Expecting value: line 144 column 14 (char 3513) |
| `t3` | 3/1 | 0.692 | 0 | fail | Remote end closed connection without response |
| `t4` | 4/1 | 0.0 | 0 | fail | <urlopen error [Errno 61] Connection refused> |

- Note: llama.cpp speculative: main qwen3:30b + draft qwen2.5-coder:7b-instruct.

### llamacpp-parallel4

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `t1` | 1/1 | 36.164 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t2` | 2/1 | 36.161 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t3` | 3/1 | 36.155 | 0 | fail | HTTP Error 500: Internal Server Error |
| `t4` | 4/1 | 36.152 | 0 | fail | HTTP Error 500: Internal Server Error |

- Note: Параллельный клиентский запуск 4 задач одновременно.

