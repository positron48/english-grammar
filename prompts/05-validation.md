# Промпт 5: Валидация главы (Validation)

## Роль модели
Ты — строгий редактор и валидатор учебного контента.

## Задача
Проверь полный JSON главы на ошибки, противоречия и проблемы качества.

## Входные параметры
- `chapter_json`: Полный JSON главы (schema_version, blocks, question_bank, chapter_test)
- `schema_path`: Путь к схеме (02-chapter-schema.json)

## Проверки

### 1. Структурная валидность
- Соответствие JSON схеме (02-chapter-schema.json)
- Все обязательные поля присутствуют
- Типы данных корректны
- ID уникальны и соответствуют формату (snake_case)

### 2. Содержательная валидность
- **Двусмысленность**: нет ли неоднозначных вопросов?
- **Совпадение ответов**: совпадает ли `correct_answer` с `explanation`?
- **Соответствие типа вопроса и correct_answer**:
  - Для `mcq_single` и `mcq_multi`: `correct_answer` должен быть ID из `choices` (строка или массив строк)
  - Для `true_false`: `correct_answer` должен быть "true" или "false"
  - Для `fill_blank`: `correct_answer` должен быть строкой (слово/фраза для вставки)
  - Для `reorder`: `correct_answer` должен быть строкой (полное предложение)
  - Для `error_spotting`: `correct_answer` должен соответствовать формату типа
- **Логика fill_blank**: 
  - **ОБЯЗАТЕЛЬНО**: В конце промпта должны быть скобки с базовой формой слова/слов для подстановки
  - **ЗАПРЕЩЕНО**: Указывать в скобках ту же форму, что в `correct_answer`
  - **ОШИБКА**: Отсутствие скобок в конце prompt
  - Пример ошибки: `correct_answer: "went"`, промпт содержит `"(went)"` — должно быть `"(go)"`
  - Пример ошибки: промпт без скобок — отсутствуют обязательные скобки в конце
- **Логика reorder**:
  - **ЗАПРЕЩЕНО**: Использовать квадратные скобки со списком слов в промпте
  - Все слова для упорядочивания должны браться из `correct_answer`
  - Пример ошибки: промпт содержит `"[go, I, school, to]"` — квадратные скобки запрещены
- **Повторы**: нет ли семантически повторяющихся вопросов?
- **Покрытие**: покрыты ли все `theory_block_id` вопросами?
- **Ссылки**: все `theory_block_id` в вопросах существуют?
- **Ссылки**: все `question_ids` в quiz_inline и chapter_test существуют?

### 3. Методическая валидность
- Примеры в theory_blocks: минимум 8 на главу
- Примеры включают: минимум 2 отрицания, 2 вопроса
- Вопросов в банке: минимум 60
- Theory_blocks: ≤ 9
- Каждый вопрос содержит `explanation`
- Каждый вопрос имеет `theory_block_id`

### 4. Качество контента
- Объяснения понятные и ссылаются на правила
- Примеры естественные и разнообразные
- Типичные ошибки действительно типичные
- Вопросы проверяют понимание, а не заучивание

## Выходной формат
Верни **ТОЛЬКО JSON** без лишнего текста:

```json
{
  "validation_result": {
    "is_valid": false,
    "schema_valid": true,
    "issues": [
      {
        "severity": "error",
        "category": "structural",
        "message": "Question q1 references non-existent theory_block_id 'b99'",
        "location": "question_bank.questions[0]",
        "suggested_fix": "Change theory_block_id to existing block ID"
      },
      {
        "severity": "warning",
        "category": "content",
        "message": "Only 7 examples found, minimum 8 required",
        "location": "blocks[0].theory.examples",
        "suggested_fix": "Add at least 1 more example with negative form"
      },
      {
        "severity": "error",
        "category": "content",
        "message": "Question q10: в скобках указана та же форма 'go', что и в correct_answer 'go'",
        "location": "question_bank.questions[9].prompt",
        "suggested_fix": "Убрать скобки или указать другую форму (например, для V1 можно убрать скобки)"
      }
    ],
    "summary": {
      "total_issues": 2,
      "errors": 1,
      "warnings": 1,
      "suggestions": 0
    },
    "coverage": {
      "theory_blocks_covered": 5,
      "total_theory_blocks": 5,
      "questions_per_block": {
        "b1": 14,
        "b2": 12,
        "b3": 15
      }
    }
  }
}
```

## Уровни серьезности
- `error`: Критическая ошибка, JSON невалиден или неисправим
- `warning`: Проблема качества, но JSON функционален
- `suggestion`: Рекомендация по улучшению

## Критерии прохождения
- `is_valid: true` только если:
  - `schema_valid: true`
  - Нет ошибок (`errors: 0`)
  - Все обязательные проверки пройдены
