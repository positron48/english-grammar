# LLM Benchmark Summary

- Started at: `2026-04-29T07:43:59Z`

## Scenarios

| Scenario | Mode | Time (s) | Tasks ok/total | Questions total | Q/s |
|---|---:|---:|---:|---:|---:|
| `ollama-seq` | `sequential` | 103.499 | 1/1 | 10 | 0.097 |
| `llamacpp-seq` | `sequential` | 113.051 | 1/1 | 10 | 0.088 |
| `llamacpp-speculative-seq` | `sequential` | 495.243 | 1/1 | 10 | 0.02 |
| `llamacpp-parallel4` | `parallel` | 92.073 | 1/1 | 10 | 0.109 |

## Per-task details

### ollama-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `fast1` | 1/1 | 103.424 | 10 | ok |  |

- Note: Базовый последовательный режим через Ollama.

### llamacpp-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `fast1` | 1/1 | 112.959 | 10 | ok |  |

- Note: Базовый последовательный режим через llama.cpp OpenAI-compatible endpoint.

### llamacpp-speculative-seq

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `fast1` | 1/1 | 495.132 | 10 | ok |  |

- Note: llama.cpp speculative: main qwen3:30b + draft qwen2.5-coder:7b-instruct.

### llamacpp-parallel4

| Task | Ch/Block | Latency (s) | Questions | Status | Error |
|---|---:|---:|---:|---:|---|
| `fast1` | 1/1 | 91.99 | 10 | ok |  |

- Note: Параллельный клиентский запуск 4 задач одновременно.

