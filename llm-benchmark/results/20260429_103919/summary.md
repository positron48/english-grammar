# LLM Benchmark Summary

- Started at: `2026-04-29T07:32:29Z`

## Scenarios

| Scenario | Mode | Time (s) | Tasks ok/total | Questions total | Q/s |
|---|---:|---:|---:|---:|---:|
| `ollama-seq` | `sequential` | 108.404 | 1/1 | 10 | 0.092 |
| `llamacpp-seq` | `sequential` | 105.774 | 1/1 | 10 | 0.095 |
| `llamacpp-speculative-seq` | `sequential` | 99.039 | 1/1 | 10 | 0.101 |
| `llamacpp-parallel4` | `parallel` | 97.583 | 1/1 | 10 | 0.102 |

## Per-task details

### ollama-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `fast1` | 1/1 | 107.743 | 10 | ok |  |

- Note: Базовый последовательный режим через Ollama.

### llamacpp-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `fast1` | 1/1 | 92.491 | 10 | ok |  |

- Note: Базовый последовательный режим через llama.cpp OpenAI-compatible endpoint.

### llamacpp-speculative-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `fast1` | 1/1 | 96.853 | 10 | ok |  |

- Note: llama.cpp с включенным --spec-default на том же весе qwen3:30b.

### llamacpp-parallel4

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `fast1` | 1/1 | 95.362 | 10 | ok |  |

- Note: Параллельный клиентский запуск 4 задач одновременно.

