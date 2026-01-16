# Мастер-промпт: Генерация всей главы за один проход

## Задача
Сгенерировать полную главу курса грамматики английского языка, выполнив все 5 проходов последовательно.

## Входные данные
- `chapter_input`: Параметры главы (section_id, chapter_id, title, level, ui_language, target_language, prerequisites)

## Процесс генерации

Выполни следующие шаги **последовательно**, используя соответствующие промпты:

### Шаг 1: План главы
Используй промпт `prompts/01-plan.md` и входные данные `chapter_input`.
Сгенерируй `chapters/{chapter_id}/01-outline.json` согласно промпту.

### Шаг 2: Theory Blocks
Для каждого theory_block из плана (из `01-outline.json`):
- Используй промпт `prompts/02-theory-block.md`
- Используй данные блока из плана
- Сгенерируй `chapters/{chapter_id}/02-theory-blocks/{block_id}.json`

### Шаг 3: Банк вопросов
Используй:
- Промпт `prompts/03-questions.md`
- План из `chapters/{chapter_id}/01-outline.json`
- Все theory_blocks из `chapters/{chapter_id}/02-theory-blocks/*.json`

Сгенерируй `chapters/{chapter_id}/03-questions.json` с минимум 60 вопросами.

### Шаг 4: Inline Quizzes
Используй:
- Промпт `prompts/04-inline-quizzes.md`
- План из `chapters/{chapter_id}/01-outline.json`
- Question_bank из `chapters/{chapter_id}/03-questions.json`

Сгенерируй `chapters/{chapter_id}/04-inline-quizzes.json`.

### Шаг 5: Сборка и валидация
1. Собери финальный JSON из всех частей:
   - Используй `scripts/assemble-chapter.sh` ИЛИ собери вручную по схеме `02-chapter-schema.json`
   - Сохрани в `chapters/{chapter_id}/05-final.json`

2. Валидация:
   - Используй промпт `prompts/05-validation.md`
   - Проверь `chapters/{chapter_id}/05-final.json` на соответствие `02-chapter-schema.json`
   - Сохрани результат валидации в `chapters/{chapter_id}/05-validation.json`

3. **ВАЖНО: Закоммить все изменения:**
   ```bash
   git add chapters/{chapter_id}/ config/generation-status.json
   git commit -m "feat: сгенерирована глава {chapter_id}

   - Глава: {title} ({level})
   - Созданы все файлы: outline, theory blocks, questions, inline quizzes, final JSON
   - Валидация: {is_valid ? 'пройдена' : 'есть ошибки'}
   - Обновлен generation-status.json"
   ```
   Это критически важно для отслеживания прогресса и возможности восстановления после сбоя.

## Важные правила

1. **Выполняй шаги последовательно** - не переходи к следующему шагу, пока не завершен предыдущий
2. **Проверяй результаты** - после каждого шага убедись, что JSON валиден
3. **Следуй промптам строго** - каждый шаг должен использовать соответствующий промпт из `prompts/`
4. **Верни ТОЛЬКО JSON** - без markdown блоков и пояснений (кроме комментариев в JSON)
5. **Используй стабильные ID** - snake_case, без пробелов
6. **Соответствуй схеме** - проверь соответствие `02-chapter-schema.json`
7. **Коммит после завершения** - **ОБЯЗАТЕЛЬНО** закоммить все изменения после завершения генерации главы

## Выходные файлы

После выполнения всех шагов должны быть созданы:
- `chapters/{chapter_id}/01-outline.json` - план главы
- `chapters/{chapter_id}/02-theory-blocks/{block_id}.json` - theory blocks (по одному файлу на блок)
- `chapters/{chapter_id}/03-questions.json` - банк вопросов
- `chapters/{chapter_id}/04-inline-quizzes.json` - inline quizzes
- `chapters/{chapter_id}/05-final.json` - финальный JSON главы
- `chapters/{chapter_id}/05-validation.json` - результат валидации

## Формат ответа

После завершения всех шагов, выведи краткую сводку:
- Количество theory_blocks создано
- Количество вопросов создано
- Результат валидации (is_valid: true/false)
- Список созданных файлов
