# LLM Benchmark (English Grammar)

Изолированный бенч-пакет для сравнения скорости генерации вопросов на одинаковой задаче:

- 4 theory-блока из разных глав;
- по 10 вопросов на блок;
- сравнение разных бэкендов и режимов.

## Что внутри

- `benchmark.py` — runner и сбор метрик.
- `scenarios.json` — набор сценариев (ollama, llama.cpp, speculative, parallel).
- `tasks.json` — список задач (глава/блок/кол-во вопросов).
- `Makefile` — удобные команды запуска.

## Быстрый запуск

```bash
cd courses/english-grammar/llm-benchmark
make bench-all
```

Быстрый smoke-прогон на 1 блок:

```bash
make bench-fast
```

Бенч теперь сам:

- останавливает LLM-серверы перед сценарием;
- поднимает нужный сервер для сценария;
- ждёт readiness endpoint;
- после сценария гасит сервер.
- считает `time` только на сами запросы (без времени старт/стоп серверов).

Только один сценарий:

```bash
make bench SCENARIO=llamacpp-seq
```

## Результаты

Сохраняются в:

- `results/<timestamp>/results.json`
- `results/<timestamp>/summary.md`

`summary.md` содержит сравнительную сводку по времени и throughput.

## Про speculative decoding

Клиентский скрипт не включает speculative сам по себе — он измеряет endpoint как есть.
Для сценария `llamacpp-speculative-seq` поднимите отдельный `llama-server` с нужными флагами speculative на порту, указанном в `scenarios.json` (по умолчанию `8091`), и сравните со `llamacpp-seq`.

Сценарии используют тот же вес, что в Ollama `qwen3:30b`:

- `/Users/antonfilatov/.ollama/models/blobs/sha256-58574f2e94b99fb9e4391408b57e5aeaaaec10f6384e9a699fc2cb43a5c8eabf`

Если нужно поменять путь/флаги запуска сервера, правьте `scenarios.json` (`start_cmd`, `stop_cmd`, `wait_url`).

Для speculative-сценария используется отдельная draft-модель:

- `/Users/antonfilatov/.ollama/models/blobs/sha256-60e05f2100071479f596b964f89f510f057ce397ea22f2833a0cfe029bfc2463`
