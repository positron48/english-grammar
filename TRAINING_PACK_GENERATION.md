# English Grammar: генерация training pack

Этот документ описывает полный процесс генерации `training_pack` в `courses/english-grammar`:
что где лежит, какие промпты используются, как запускать генерацию/валидацию и где задавать параметры локальной LLM.

---

## 1) Что это и зачем

`training_pack` — это отдельный артефакт с вопросами для режима **Grammar SRS** в приложении.

Ключевые принципы:

- курс (`chapters/*/05-final.json`) остается source of truth по теории;
- `training_pack` генерируется внутри курса;
- приложение читает готовые JSON, без вызовов LLM в runtime;
- если pack пустой/невалидный, режим тренировки должен быть недоступен.

---

## 2) Структура файлов

### Источники (вход)

- `chapters/*/05-final.json` (или `04-final.json` fallback)
- `prompts/16-training-pack-generator-system.md` — системный промпт генератора
- `config/training-pack.json` — дефолтные параметры генератора
- `scripts/fill-training-pack.py` — оркестратор массовой догенерации до целевого порога

### Артефакты (выход)

- `training_pack/index.json`
- `training_pack/chapters/<chapter_num>/en.<block_num>.<block_id>.questions.json`
- `training_pack/reports/build-report.json`
- `training_pack/reports/validation-report.json`
- `training_pack/runs/<timestamp>/en.<chapter>.<block>.<chapter_id>.<block_id>.raw.json`

---

## 3) Контракт формата

### `training_pack/index.json`

Минимальные поля:

- `version`
- `language` (`en`)
- `course_id` (`english-grammar`)
- `generated_at`
- `generator_version`
- `mode` (`llm-only`)
- `prompt_version`
- `chapters` (`chapter_id -> [files]`)
- `blocks` (`chapter_id::block_id -> relative_file_path`)

### `training_pack/chapters/*.questions.json`

Поля:

- `chapter_id`
- `theory_block_id`
- `course_version`
- `questions[]`
- `meta`

Каждый вопрос после генератора обязан иметь:

- `id`
- `type` (`mcq_single`)
- `prompt` (RU)
- `choices` (4 варианта `a,b,c,d`, тексты на EN)
- `correct_answer`
- `explanation` (RU)
- `theory_block_id`
- `chapter_id`
- `concept_id`
- `difficulty` (диапазон `1..5`)
- `signature` (для дедупа)

---

## 4) Промпты и их роль

Основной файл:

- `prompts/16-training-pack-generator-system.md`

Он задает:

- допустимые типы вопросов;
- обязательные поля JSON;
- ограничения качества distractors;
- запрет на проверку знаний за пределами `theory_block_id`;
- запрет на дословное копирование примеров из теории.

Если хотите менять стиль/строгость генерации — в первую очередь правьте этот файл.

---

## 5) Режим генерации (только LLM)

Генераторы:

- `scripts/generate-training-pack.py` — точечная генерация (один/несколько блоков)
- `scripts/fill-training-pack.py` — последовательная генерация по блокам до целевого порога

Доступны 2 режима записи:

- replace (по умолчанию): для целевого блока заменяет ранее сгенерированные вопросы;
- append (`--append`): добавляет новые вопросы к существующим.

Команды:

```bash
# базовая генерация (replace mode)
make training-pack

# догенерация новых вопросов (append mode)
make training-pack-append

# массовая догенерация по всем блокам до целевого порога
make training-pack-fill

# легкая админка training pack
make training-pack-admin
```

`training-pack-fill` использует `--append` под капотом и повторяет генерацию батчами, пока валидных вопросов не станет >= target.

### macOS: длинные прогоны (`caffeinate`)

Для ночных запусков используйте:

```bash
caffeinate -dims make training-pack-fill
```

Или точечно:

```bash
caffeinate -dims python3 scripts/fill-training-pack.py \
  --course-root . \
  --chapter-number 1 \
  --batch-size 5 \
  --target-valid 10
```

---

## 6) Где задавать параметры локальной LLM (llama.cpp)

Через `config/training-pack.json`:

- `defaults.min_per_block`
- `defaults.questions_per_block`
- `defaults.llm_model`
- `defaults.llm_base_url`

Через env (переопределяют config):

- `LLM_BASE_URL`
- `TRAINING_PACK_MODEL`

Пример:

```bash
export LLM_BASE_URL="http://127.0.0.1:8090"
export TRAINING_PACK_MODEL="qwen3:30b"
make training-pack
```

Рекомендуется хранить локальные переменные в `.env.local` (вне git).

### Быстрый старт llama.cpp server

Пример локального запуска OpenAI-compatible сервера llama.cpp:

```bash
llama-server \
  -m /Users/antonfilatov/.ollama/models/blobs/sha256-58574f2e94b99fb9e4391408b57e5aeaaaec10f6384e9a699fc2cb43a5c8eabf \
  --alias qwen3:30b \
  --host 127.0.0.1 \
  --port 8090 \
  -ngl 999
```

После старта сервера:

```bash
export LLM_BASE_URL="http://127.0.0.1:8090"
export TRAINING_PACK_MODEL="qwen3:30b"
make training-pack
```

Примечание: `TRAINING_PACK_MODEL` в llama.cpp обычно формальный идентификатор для OpenAI-совместимого API; главное — чтобы сервер был поднят и отвечал на `/v1/chat/completions`.

---

## 7) Полный workflow (рекомендуемый)

1. Пересобрать главы:

```bash
make final
```

2. Точечный прогон на одной главе/блоке:

```bash
python3 scripts/generate-training-pack.py \
  --course-root . \
  --chapter-number 1 \
  --block-number 1 \
  --questions-per-block 3
```

3. Догенерация в append:

```bash
python3 scripts/generate-training-pack.py \
  --course-root . \
  --chapter-number 1 \
  --block-number 1 \
  --questions-per-block 3 \
  --append
```

4. Проверить отчеты:

- `training_pack/reports/validation-report.json`
- `training_pack/reports/build-report.json`

5. Проверить raw-ответы модели:

- `training_pack/runs/<timestamp>/*.raw.json`

6. После точечной проверки — запуск по всему курсу:

```bash
caffeinate -dims python3 scripts/fill-training-pack.py \
  --course-root . \
  --batch-size 10 \
  --target-valid 5
```

---

## 8) Что проверяет валидатор

Проверки:

- обязательные поля вопроса;
- `type` только `mcq_single`;
- `prompt` не пустой и содержит кириллицу;
- `explanation` не пустой и содержит кириллицу;
- `choices` ровно 4 с id `a,b,c,d`;
- `correct_answer` ссылается на `choices[].id`;
- `theory_block_id` существует в блоках главы;
- `chapter_id` совпадает с файлом;
- дедуп внутри/между файлами по `signature`;
- минимум вопросов на блок (`min_per_block`).

При ошибках валидации генератор завершает работу с кодом `2`.

---

## 9) Интеграция с приложением

После успешной генерации в `courses/english-grammar`:

```bash
cd /Users/antonfilatov/www/my/k3s/english-ai-bot
make grammar-bundle
```

Эта команда копирует pack в embedded-слой:

- `internal/grammartrainingpack/en/...`

---

## 10) Диагностика проблем

- `training_pack` пустой:
  - проверьте фильтры `--chapter-number`, `--block-number`;
  - проверьте `LLM_BASE_URL` и `TRAINING_PACK_MODEL`.
- Много блоков ниже порога:
  - увеличьте `questions_per_block`;
  - улучшите системный промпт;
  - запустите `fill-training-pack.py`.
- Модель возвращает не JSON:
  - смотрите `training_pack/runs/*/*.raw.json`;
  - ужесточайте системный промпт;
  - используйте более стабильную модель.
