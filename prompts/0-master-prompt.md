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

Проверь текущий статус и генерируй следующую главу.
По завершению запусти make validate-all и почини ошибки и предупреждения.