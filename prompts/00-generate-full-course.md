# Мастер-промпт: Генерация всего курса

## Задача
Сгенерировать весь курс грамматики английского языка, создав все главы последовательно с автоматическим отслеживанием прогресса.

## Входные данные
- `01-sections.md` - структура курса со всеми разделами и главами
- `config/generation-status.json` - файл статуса генерации (будет создан/обновлен автоматически)
- `02-chapter-schema.json` - схема JSON для валидации

## Процесс генерации

### Шаг 0: Подготовка входных файлов глав

**ВАЖНО:** Если входные файлы глав еще не созданы, сначала выполни:

1. Используй промпт `prompts/00-prepare-chapter-inputs.md`
2. Прочитай `01-sections.md`
3. Для каждой главы создай входной файл `config/chapter-templates/{chapter_id}-input.json`
4. Обнови `config/generation-status.json` со списком всех глав

**Проверка:** Если файл `config/generation-status.json` существует и содержит список глав, можно пропустить этот шаг.

### Шаг 1: Чтение статуса генерации

1. Прочитай `config/generation-status.json`
2. Если файла нет или он пуст, сначала выполни Шаг 0 (подготовка входных файлов)
3. Определи, какие главы уже сгенерированы (`status: "generated"` или `"validated"`)
4. Определи, какие главы нужно сгенерировать (`status: "pending"` или отсутствует)
5. Определи порядок генерации (по `order` в status файле)

### Шаг 2: Генерация глав последовательно

Для каждой главы со статусом `pending` (в порядке `order`):

1. **Обнови статус главы** в `config/generation-status.json`:
   ```json
   {
     "chapters": [
       {
         "chapter_id": "...",
         "status": "in_progress",
         "started_at": "2026-01-16T12:00:00Z"
       }
     ]
   }
   ```

2. **Используй мастер-промпт для главы**: `prompts/00-generate-full-chapter.md`
   - Входные данные: `config/chapter-templates/{chapter_id}-input.json`
   - Выполни все 5 проходов генерации главы
   - Сохрани все выходные файлы в `chapters/{chapter_id}/`

3. **После завершения генерации главы:**
   - Обнови статус в `config/generation-status.json`:
     ```json
     {
       "chapters": [
         {
           "chapter_id": "...",
           "status": "generated",
           "completed_at": "2026-01-16T12:30:00Z",
           "files": {
             "outline": "chapters/{chapter_id}/01-outline.json",
             "theory_blocks": "chapters/{chapter_id}/02-theory-blocks/",
             "questions": "chapters/{chapter_id}/03-questions.json",
             "inline_quizzes": "chapters/{chapter_id}/04-inline-quizzes.json",
             "final": "chapters/{chapter_id}/05-final.json",
             "validation": "chapters/{chapter_id}/05-validation.json"
           }
         }
       ]
     }
     ```

4. **Если генерация не удалась:**
   - Обнови статус на `failed`
   - Запиши ошибку (если есть)
   - Продолжи со следующей главы

5. **Обнови summary в status файле:**
   ```json
   {
     "summary": {
       "total_sections": 19,
       "total_chapters": 150,
       "chapters_generated": 45,
       "chapters_in_progress": 1,
       "chapters_pending": 104,
       "chapters_failed": 0
     }
   }
   ```

### Шаг 3: Валидация глав

После генерации каждой главы (или после всех глав):

1. Проверь `chapters/{chapter_id}/05-validation.json`
2. Если `is_valid: false`, отметь проблемы в status файле
3. Если валидация прошла успешно, обнови статус на `validated`

### Шаг 4: Сборка манифеста курса

После генерации всех глав (или после генерации раздела):

1. Создай/обнови `grammar/manifest.json`:
   ```json
   {
     "version": "1.0.0",
     "last_updated": "2026-01-16T12:00:00Z",
     "sections": [
       {
         "section_id": "en.grammar.perfect_aspect",
         "title": "The Perfect aspect: experience, result, duration",
         "level": "B1",
         "order": 13,
         "chapters": [
           {
             "chapter_id": "en.grammar.perfect_aspect.present_perfect_form",
             "title": "Present Perfect form: have/has + V3",
             "order": 131,
             "level": "B1",
             "status": "validated"
           }
         ]
       }
     ]
   }
   ```

## Важные правила

1. **Генерация по одной главе** - не начинай следующую главу, пока не завершена текущая
2. **Обновление статуса после каждой главы** - обязательно обновляй `config/generation-status.json` после генерации каждой главы
3. **Проверка перед генерацией** - если глава уже сгенерирована (`status: "generated"` или `"validated"`), пропусти её
4. **Использование существующих входных данных** - если файл уже существует в `config/chapter-templates/`, используй его
5. **Следуй порядку** - генерируй главы в порядке `order` из status файла
6. **Учитывай prerequisites** - при генерации плана главы учитывай, какие главы должны быть пройдены до неё
7. **Отслеживание прогресса** - регулярно обновляй `summary` в status файле

## Структура status файла

`config/generation-status.json` должен содержать:

```json
{
  "version": "1.0.0",
  "last_updated": "2026-01-16T12:00:00Z",
  "sections": [
    {
      "section_id": "en.grammar.perfect_aspect",
      "title": "The Perfect aspect",
      "level": "B1",
      "order": 13,
      "chapter_ids": ["...", "..."]
    }
  ],
  "chapters": [
    {
      "chapter_id": "en.grammar.perfect_aspect.present_perfect_form",
      "section_id": "en.grammar.perfect_aspect",
      "title": "Present Perfect form",
      "level": "B1",
      "order": 131,
      "status": "generated",
      "started_at": "2026-01-16T12:00:00Z",
      "completed_at": "2026-01-16T12:30:00Z",
      "input_file": "config/chapter-templates/en.grammar.perfect_aspect.present_perfect_form-input.json",
      "output_dir": "chapters/en.grammar.perfect_aspect.present_perfect_form",
      "files": {
        "outline": "chapters/{chapter_id}/01-outline.json",
        "final": "chapters/{chapter_id}/05-final.json"
      },
      "validation": {
        "is_valid": true,
        "last_validated": "2026-01-16T12:35:00Z"
      }
    }
  ],
  "summary": {
    "total_sections": 19,
    "total_chapters": 150,
    "chapters_generated": 45,
    "chapters_in_progress": 1,
    "chapters_pending": 104,
    "chapters_failed": 0,
    "chapters_validated": 45
  }
}
```

## Статусы глав

- `pending` - входной файл создан, но генерация не начата
- `in_progress` - генерация в процессе (не перезапускай!)
- `generated` - глава сгенерирована успешно (все файлы созданы)
- `validated` - глава прошла валидацию (`05-validation.json` показывает `is_valid: true`)
- `failed` - ошибка при генерации

## Формат ответа

После завершения (или после каждой главы), выведи сводку:
- Текущий прогресс: `X из Y глав сгенерировано`
- Статус текущей главы
- Следующая глава для генерации
- Список глав со статусом `failed` (если есть)

## Оптимизация процесса

1. **Генерация батчами** - можно генерировать по 5-10 глав, затем проверять результаты
2. **Пропуск существующих** - если глава уже сгенерирована, пропускай её
3. **Восстановление после сбоя** - если генерация прервалась, можно продолжить с последней главы со статусом `pending`

## Рекомендации

1. После каждых 10 глав делай паузу и проверяй результаты
2. Регулярно проверяй `config/generation-status.json` на актуальность
3. Если глава не удалась, запиши ошибку в status файл и продолжи со следующей
4. После завершения всех глав проверь манифест курса (`grammar/manifest.json`)
