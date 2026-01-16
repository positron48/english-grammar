# Промпт 1: План главы (Chapter Outline)

## Роль модели
Ты — методист и автор курса грамматики английского языка.

## Задача
Сгенерируй ПЛАН главы на основе входных параметров.

## Входные параметры
- `section_id`: ID раздела (например, "en.grammar.perfect_aspect")
- `chapter_id`: ID главы (например, "en.grammar.present_perfect.experience")
- `title`: Название главы (например, "Present Perfect: experience")
- `level`: Уровень (A1, A2, B1, B2, C1, C2, mixed)
- `ui_language`: Язык интерфейса объяснений (например, "ru")
- `target_language`: Язык примеров (например, "en")
- `prerequisites`: Список chapter_id предварительных глав (опционально)

## Ограничения
- `theory_blocks`: 5–7 блоков (строго < 10)
- Каждый `theory_block` покрывает ровно 1 главный принцип
- Укажи `concept_id` для каждого блока (snake_case, без пробелов)
- Укажи типичные ошибки русскоязычных (если уместно)
- Используй стабильные ID: snake_case, без пробелов

## Выходной формат
Верни **ТОЛЬКО JSON** без текста вокруг, по следующей схеме:

```json
{
  "chapter_outline": {
    "chapter_id": "en.grammar.present_perfect.experience",
    "section_id": "en.grammar.perfect_aspect",
    "title": "Present Perfect: experience (Have you ever…?)",
    "title_short": "Present Perfect: experience",
    "description": "Краткое описание главы (1-2 предложения)",
    "level": "B1",
    "ui_language": "ru",
    "target_language": "en",
    "prerequisites": ["en.grammar.past_simple.basics"],
    "learning_objectives": [
      "Цель обучения 1",
      "Цель обучения 2",
      "Цель обучения 3"
    ],
    "estimated_minutes": 22,
    "theory_blocks": [
      {
        "id": "b1_theory_experience_meaning",
        "concept_id": "present_perfect_experience",
        "title": "Основная идея: опыт без точного времени",
        "order": 1,
        "description": "Краткое описание блока (1 предложение)"
      },
      {
        "id": "b2_theory_markers",
        "concept_id": "ever_never_before",
        "title": "Маркеры: ever / never / before",
        "order": 2,
        "description": "Краткое описание блока"
      }
    ],
    "concept_refs": [
      "present_perfect_experience",
      "ever_never_before"
    ],
    "question_types_needed": [
      "mcq_single",
      "fill_blank",
      "error_spotting",
      "reorder",
      "true_false"
    ]
  }
}
```

## Критерии качества
- План логичен и последователен
- Каждый theory_block фокусируется на одном концепте
- concept_id уникальны и описательны
- Учтены предварительные требования
