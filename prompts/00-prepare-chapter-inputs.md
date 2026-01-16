# Промпт: Подготовка входных файлов глав из 01-sections.md

## Задача
Извлечь список всех глав из `01-sections.md` и создать входные файлы `config/chapter-templates/{chapter_id}-input.json` для каждой главы.

## Входные данные
- `01-sections.md` - структура курса со всеми разделами и главами

## Формат глав в 01-sections.md

Главы указаны в формате:
- `### Section N. Название раздела (уровень)`
- `N.M. Название главы (описание)`

Пример:
```
### Section 13. The Perfect aspect: experience, result, duration (B1)

13.1. Present Perfect form: have/has + V3
13.2. Result: I've lost my keys (result matters now)
13.3. Experience: Have you ever…? never/before; been vs gone
13.4. Duration: for/since; How long…? (link to now)
```

## Правила создания chapter_id

1. Формат: `en.grammar.{section_topic}.{chapter_topic}`
2. Используй snake_case для всех частей
3. Извлекай section_topic из названия раздела (после "Section N.")
4. Извлекай chapter_topic из названия главы (первые ключевые слова)

Примеры:
- Section 13, глава "13.1. Present Perfect form" → `en.grammar.perfect_aspect.present_perfect_form`
- Section 3, глава "3.1. Verbs as actions" → `en.grammar.present_simple.verbs_as_actions`

## Формат выходного файла

Для каждой главы создай файл `config/chapter-templates/{chapter_id}-input.json`:

```json
{
  "chapter_input": {
    "section_id": "en.grammar.{section_topic}",
    "chapter_id": "en.grammar.{section_topic}.{chapter_topic}",
    "title": "Полное название главы из 01-sections.md",
    "title_short": "Краткое название (опционально)",
    "description": "Описание из 01-sections.md (если есть)",
    "level": "Уровень из раздела (A0, A1, A2, B1, B2, C1, C2, mixed)",
    "order": "Порядковый номер (из N.M)",
    "ui_language": "ru",
    "target_language": "en",
    "prerequisites": []
  }
}
```

## Определение уровня (level)

Извлекай уровень из названия раздела:
- `(A0)` → `"A0"`
- `(A0–A1)` → `"A1"` (берем верхний уровень)
- `(A1–A2)` → `"A2"`
- `(B1–B2)` → `"B2"`
- Если не указан, используй уровень предыдущего раздела или `"A1"`

## Определение section_id

Создай стабильный section_id на основе названия раздела:
- `Section 13. The Perfect aspect` → `en.grammar.perfect_aspect`
- `Section 3. First actions: **Present Simple**` → `en.grammar.present_simple`

Используй snake_case, удаляй артикли и служебные слова.

## Определение prerequisites

Автоматически определи prerequisites:
- Главы из предыдущего раздела (опционально)
- Базовые главы из текущего раздела (если глава не первая)

Не устанавливай prerequisites для первых глав разделов (N.1).

## Обновление status файла

После создания всех входных файлов, обнови `config/generation-status.json`:

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
      "chapter_ids": ["en.grammar.perfect_aspect.present_perfect_form", ...]
    }
  ],
  "chapters": [
    {
      "chapter_id": "en.grammar.perfect_aspect.present_perfect_form",
      "section_id": "en.grammar.perfect_aspect",
      "title": "Present Perfect form: have/has + V3",
      "level": "B1",
      "order": 131,
      "status": "pending",
      "input_file": "config/chapter-templates/en.grammar.perfect_aspect.present_perfect_form-input.json",
      "output_dir": "chapters/en.grammar.perfect_aspect.present_perfect_form"
    }
  ],
  "summary": {
    "total_sections": 19,
    "total_chapters": 150,
    "chapters_generated": 0,
    "chapters_in_progress": 0,
    "chapters_pending": 150,
    "chapters_failed": 0
  }
}
```

## Статусы глав

- `pending` - входной файл создан, но генерация не начата
- `in_progress` - генерация в процессе
- `generated` - глава сгенерирована успешно
- `failed` - ошибка при генерации
- `validated` - глава сгенерирована и прошла валидацию

## Инструкции

1. Прочитай `01-sections.md`
2. Извлеки все разделы (Section N.) и главы (N.M.)
3. Для каждой главы:
   - Создай `chapter_id` по правилам выше
   - Создай `section_id` из раздела
   - Определи `level` из раздела
   - Создай входной файл в `config/chapter-templates/{chapter_id}-input.json`
4. Обнови `config/generation-status.json` с информацией о всех главах

## Критерии качества

- Все chapter_id уникальны и следуют формату
- Все section_id стабильны и соответствуют разделам
- Уровни (level) определены корректно
- Prerequisites установлены логично (для зависимых глав)
- Status файл обновлен со всеми главами

## Формат ответа

После завершения выведи сводку:
- Количество разделов обработано
- Количество глав обработано
- Количество входных файлов создано
- Путь к обновленному status файлу
