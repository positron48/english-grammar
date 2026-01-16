# Генерация курса грамматики английского языка

## Как запустить генерацию всего курса

**Одна команда в Cursor:**

```
@prompts/00-generate-full-course.md @01-sections.md @02-chapter-schema.json @prompts/00-generate-full-chapter.md @prompts/00-prepare-chapter-inputs.md

Используй мастер-промпт из prompts/00-generate-full-course.md.

1. Сначала проверь config/generation-status.json:
   - Если файла нет или он пуст, используй prompts/00-prepare-chapter-inputs.md:
     * Извлеки все главы из 01-sections.md
     * Создай входные файлы config/chapter-templates/{chapter_id}-input.json для каждой главы
     * Создай/обнови config/generation-status.json со списком всех глав

2. Для каждой главы со статусом "pending" (в порядке order):
   - Обнови статус на "in_progress" в config/generation-status.json
   - Используй prompts/00-generate-full-chapter.md для генерации главы
   - После генерации обнови статус на "generated" и обнови summary в status файле

3. После генерации всех глав создай/обнови grammar/manifest.json

Генерируй главы последовательно, обновляя config/generation-status.json после каждой главы.
Проверяй прогресс в summary: chapters_generated, chapters_pending, chapters_failed.

После завершения выведи итоговую сводку: общее количество глав, сгенерировано, валидировано, ошибки.
```

## Как продолжить генерацию

Если генерация была прервана, используй ту же команду — Cursor автоматически продолжит с последней незавершенной главы (статус `pending` или `in_progress`).

**Проверить прогресс:**

```bash
jq .summary config/generation-status.json
```

**Посмотреть статус глав:**

```bash
jq '.chapters[] | {chapter_id, status, order}' config/generation-status.json | less
```

## Мастер-промпты

- **`prompts/00-generate-full-course.md`** — мастер-промпт для генерации всего курса (используется в команде выше)
- **`prompts/00-generate-full-chapter.md`** — мастер-промпт для генерации одной главы
- **`prompts/00-prepare-chapter-inputs.md`** — промпт для создания входных файлов глав из 01-sections.md

## Структура файлов

- `01-sections.md` — структура курса со всеми разделами и главами
- `02-chapter-schema.json` — JSON схема для валидации глав
- `03-chapter-example.json` — пример главы
- `config/generation-status.json` — файл статуса генерации (создается автоматически)
- `config/chapter-templates/` — входные файлы глав (создаются автоматически)
- `chapters/` — сгенерированные главы (создаются автоматически)
- `prompts/` — промпты для генерации
