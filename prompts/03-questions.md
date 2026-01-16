# Промпт 3: Банк вопросов (Question Bank)

## Роль модели
Ты — составитель тестов и упражнений по грамматике.

## Задача
Сгенерируй question_bank для главы на основе всех theory_blocks.

## Входные параметры
- `chapter_id`: ID главы
- `theory_blocks`: Список всех theory_blocks с их ID и concept_id
- `question_types_needed`: Типы вопросов из плана
- `ui_language`: Язык интерфейса объяснений
- `target_language`: Язык примеров

## Ограничения
- Всего вопросов: минимум 60, рекомендуется 80
- Распределение: по 12–15 вопросов на каждый theory_block_id
- Типы вопросов (минимум по 10 каждого указанного типа):
  - `mcq_single`: один правильный ответ
  - `mcq_multi`: несколько правильных ответов
  - `fill_blank`: вставить форму/слово
  - `reorder`: собрать предложение
  - `error_spotting`: найти ошибку
  - `true_false`: правда или ложь
- Каждый вопрос содержит:
  - `id`: уникальный ID (q1, q2, ...)
  - `type`: тип вопроса
  - `prompt`: текст задания (Markdown допускается)
  - `theory_block_id`: ID блока, к которому относится вопрос
  - `difficulty`: сложность 1-5
  - `correct_answer`: правильный ответ (формат зависит от типа)
  - `explanation`: объяснение (2–4 предложения, с указанием правила)
- Для `mcq_*`: массив `choices` с `id`, `text`, `feedback` (опционально)
- Для `fill_blank`: строка `correct_answer`
- Для `reorder`: строка `correct_answer` (полное предложение)
- Для `error_spotting`: массив `choices` с вариантами исправления
- Для `true_false`: строка `correct_answer` ("true" или "false")
- Вопросы должны быть вариативными:
  - разная лексика
  - разные контексты (утверждение/отрицание/вопрос)
  - разные "ловушки" (типичные смешения правил)

## Выходной формат
Верни **ТОЛЬКО JSON** без лишнего текста:

```json
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq_single",
      "prompt": "Choose the correct option: **___ you ever ___ sushi?**",
      "theory_block_id": "b1_theory_experience_meaning",
      "difficulty": 2,
      "choices": [
        {
          "id": "a",
          "text": "Did / try",
          "feedback": "Did + V1 usually describes a specific past event."
        },
        {
          "id": "b",
          "text": "Have / tried",
          "feedback": "Yes: Have + V3 is a standard experience question."
        }
      ],
      "correct_answer": "b",
      "explanation": "For experience questions we use Present Perfect: **Have you ever + V3** → Have you ever tried…?",
      "tags": []
    }
  ]
}
```

## Критерии качества
- Вопросы проверяют понимание, а не заучивание
- Вариативность по лексике и контексту
- Объяснения ссылаются на правило из theory_block
- Нет семантически повторяющихся вопросов
- Покрыты все theory_block_id
