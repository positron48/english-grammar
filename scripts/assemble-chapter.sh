#!/bin/bash

# Скрипт для сборки финального JSON главы из промежуточных файлов
# Использование: ./scripts/assemble-chapter.sh <chapter_id>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHAPTER_ID="${1:-}"

if [ -z "$CHAPTER_ID" ]; then
    echo "Ошибка: укажите chapter_id"
    echo "Использование: $0 <chapter_id>"
    exit 1
fi

CHAPTER_DIR="$PROJECT_ROOT/chapters/$CHAPTER_ID"
SCHEMA_FILE="$PROJECT_ROOT/02-chapter-schema.json"

# Проверяем наличие необходимых файлов
OUTLINE_FILE="$CHAPTER_DIR/01-outline.json"
QUESTIONS_FILE="$CHAPTER_DIR/03-questions.json"
INLINE_QUIZZES_FILE="$CHAPTER_DIR/04-inline-quizzes.json"

if [ ! -f "$OUTLINE_FILE" ]; then
    echo "Ошибка: не найден $OUTLINE_FILE"
    exit 1
fi

if [ ! -f "$QUESTIONS_FILE" ]; then
    echo "Ошибка: не найден $QUESTIONS_FILE"
    exit 1
fi

# Создаем директорию для блоков если её нет
THEORY_BLOCKS_DIR="$CHAPTER_DIR/02-theory-blocks"
mkdir -p "$THEORY_BLOCKS_DIR"

# Временные файлы
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Собираем финальный JSON
FINAL_FILE="$CHAPTER_DIR/05-final.json"

echo "Сборка финального JSON из промежуточных файлов..."

# Собираем theory_blocks
if [ "$(ls -A "$THEORY_BLOCKS_DIR"/*.json 2>/dev/null)" ]; then
    # Объединяем все theory_blocks в массив
    jq -s 'map(.theory_block)' "$THEORY_BLOCKS_DIR"/*.json > "$TEMP_DIR/theory_blocks.json"
else
    echo "⚠️  Предупреждение: нет theory_blocks файлов в $THEORY_BLOCKS_DIR"
    echo '[]' > "$TEMP_DIR/theory_blocks.json"
fi

# Читаем outline
OUTLINE_JSON=$(cat "$OUTLINE_FILE")

# Читаем theory_blocks
THEORY_BLOCKS_JSON=$(cat "$TEMP_DIR/theory_blocks.json")

# Формируем blocks: theory + inline_quizzes
# Сначала добавляем theory_blocks, затем inline_quizzes между ними
if [ -f "$INLINE_QUIZZES_FILE" ]; then
    INLINE_QUIZZES_JSON=$(jq '.inline_quizzes' "$INLINE_QUIZZES_FILE")
else
    INLINE_QUIZZES_JSON='[]'
    echo "⚠️  Предупреждение: не найден $INLINE_QUIZZES_FILE"
fi

# Собираем blocks: theory_blocks и inline_quizzes чередуются по order
jq -s '
  .[0] as $outline |
  .[1] as $theory_blocks |
  .[2] as $inline_quizzes |
  
  # Создаем мапу inline_quizzes по theory_block_id
  ($inline_quizzes | map({(.theory_block_id): .}) | add) as $quizzes_map |
  
  # Формируем blocks
  $theory_blocks | map(.id as $block_id | {
    id: $block_id,
    type: "theory",
    title: .theory_block.content_md | split("\n")[0] | gsub("^#+ *"; "") | gsub("\\*\\*"; ""),
    theory: {
      concept_id: .concept_id,
      content_md: .theory_block.content_md,
      key_points: .theory_block.key_points // [],
      common_mistakes: .theory_block.common_mistakes // [],
      examples: .theory_block.examples // []
    }
  }) as $theory_blocks_formatted |
  
  # Добавляем inline_quizzes после соответствующих theory_blocks
  reduce range(0; $theory_blocks_formatted | length) as $i (
    [];
    . + [$theory_blocks_formatted[$i]] +
    (if $quizzes_map[$theory_blocks_formatted[$i].id] then
      [{
        id: $quizzes_map[$theory_blocks_formatted[$i].id].block_id,
        type: "quiz_inline",
        title: $quizzes_map[$theory_blocks_formatted[$i].id].title // "Quick check",
        quiz_inline: {
          question_ids: $quizzes_map[$theory_blocks_formatted[$i].id].question_ids,
          show_answers_immediately: $quizzes_map[$theory_blocks_formatted[$i].id].show_answers_immediately // true
        }
      }]
    else [] end)
  )
' "$OUTLINE_FILE" "$TEMP_DIR/theory_blocks.json" "$INLINE_QUIZZES_FILE" > "$TEMP_DIR/blocks.json"

# Собираем финальный JSON
jq -s '
  .[0].chapter_outline as $outline |
  .[1] as $blocks |
  .[2] as $questions |
  
  {
    schema_version: "1.0.0",
    id: $outline.chapter_id,
    section_id: $outline.section_id,
    title: $outline.title,
    title_short: $outline.title_short // $outline.title,
    description: $outline.description,
    ui_language: $outline.ui_language,
    target_language: $outline.target_language,
    level: $outline.level,
    order: $outline.order // 0,
    prerequisites: $outline.prerequisites // [],
    concept_refs: $outline.concept_refs // [],
    learning_objectives: $outline.learning_objectives // [],
    estimated_minutes: $outline.estimated_minutes // 30,
    blocks: $blocks,
    question_bank: {
      questions: ($questions.questions // [])
    },
    chapter_test: {
      num_questions: 10,
      pool_question_ids: ($questions.questions // [] | map(.id)),
      selection_strategy: {
        type: "stratified_by_theory_block",
        min_per_theory_block: 1,
        avoid_recent_window: 30,
        difficulty_mix: {
          easy: 3,
          medium: 5,
          hard: 2
        }
      }
    },
    meta: {
      version: "2026.01.16",
      updated_at: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
      source: "llm"
    }
  }
' "$OUTLINE_FILE" "$TEMP_DIR/blocks.json" "$QUESTIONS_FILE" > "$FINAL_FILE"

echo "✓ Финальный JSON собран: $FINAL_FILE"

# Проверяем соответствие схеме (если установлен ajv-cli)
if command -v ajv &> /dev/null; then
    echo "Проверка соответствия схеме..."
    if ajv validate -s "$SCHEMA_FILE" -d "$FINAL_FILE" 2>/dev/null; then
        echo "✓ JSON соответствует схеме"
    else
        echo "⚠️  Предупреждение: JSON может не соответствовать схеме"
    fi
else
    echo "⚠️  ajv-cli не установлен, пропускаем проверку схемы"
fi

# Краткая статистика
echo ""
echo "Статистика главы:"
jq '{
  theory_blocks: (.blocks | map(select(.type == "theory")) | length),
  inline_quizzes: (.blocks | map(select(.type == "quiz_inline")) | length),
  total_questions: (.question_bank.questions | length),
  chapter_test_pool: (.chapter_test.pool_question_ids | length)
}' "$FINAL_FILE"
