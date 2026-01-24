# Генерация курса грамматики английского языка

Проект для автоматической генерации интерактивного курса английской грамматики с теорией, вопросами, квизами и тестами.

## Установка

### Требования

Для работы проекта необходимы следующие инструменты:

1. **Node.js** (для генерации индексов глав):
   ```bash
   # Ubuntu/Debian
   sudo apt install nodejs npm
   
   # Или через nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install node
   ```

2. **PHP** или **Python 3** (для запуска локальных веб-серверов):
   ```bash
   # PHP
   sudo apt install php
   
   # Python 3 (обычно уже установлен)
   sudo apt install python3
   ```

3. **jq** (для работы с JSON, опционально):
   ```bash
   sudo apt install jq
   ```

4. **Make** (для использования команд из Makefile):
   ```bash
   sudo apt install make
   ```

### Проверка установки

```bash
node --version
php --version  # или python3 --version
make --version
```

## Команды из Makefile

Проект использует Makefile для управления основными задачами. Просмотреть все доступные команды:

```bash
make help
```

### Основные команды

#### Работа с главами

- **`make final`** — Пересобрать `final.json` для всех глав (только измененные)
- **`make final-all`** или **`make final-force`** — Принудительно пересобрать все `final.json` для всех глав
- **`make validate-all`** — Валидировать все главы по схеме
- **`make validate-uniqueness`** — Проверить уникальность вопросов по всему курсу

#### Запуск веб-интерфейсов

- **`make admin`** — Запустить админ-панель для просмотра и валидации глав (порт 8000)
- **`make test`** или **`make run`** — Запустить тестовую систему для изучения курса (порт 8001)
- **`make dev`** — Запустить оба сервера одновременно (admin на 8000, test на 8001)

#### Вспомогательные команды

- **`make update-admin-index`** — Обновить индекс глав для админ-панели
- **`make update-test-index`** — Обновить индекс глав для тестовой системы
- **`make clean`** — Удалить временные файлы (*.tmp, *~)

### Примеры использования

```bash
# Валидация всех глав после генерации
make validate-all

# Запуск админ-панели для проверки глав
make admin
# Откройте http://localhost:8000/admin/

# Запуск тестовой системы для изучения
make test
# Откройте http://localhost:8001/test/

# Запуск обеих систем одновременно
make dev
```

## Описание директорий

### `admin/` — Админ-панель

Визуальная система для просмотра и валидации всех глав курса.

**Назначение:**
- Просмотр всех глав с фильтрацией и поиском
- Детальный просмотр каждой главы (теория, вопросы, квизы, валидация)
- Статистика по главам и вопросам
- Проверка результатов валидации
- Управление вопросами (удаление через API)

**Запуск:**
```bash
make admin
# Или вручную:
node admin/generate-index.js
php -S localhost:8000 -t .  # или python3 -m http.server 8000
```

**Доступ:**
- Главная страница: http://localhost:8000/admin/
- Страница главы: http://localhost:8000/admin/chapter.html

**Подробнее:** см. `admin/README.md`

### `test/` — Тестовая система

Интерактивная система для изучения курса английской грамматики.

**Назначение:**
- Навигация по разделам и главам курса
- Изучение теории с примерами и ключевыми моментами
- Inline-квизы для закрепления материала после каждого теоретического блока
- Финальные тесты с рандомизацией вопросов по стратегии отбора
- Детальные результаты тестов с объяснениями

**Запуск:**
```bash
make test
# Или вручную:
node test/scripts/generate-chapters-index.js
python3 -m http.server 8001  # или php -S localhost:8001
```

**Доступ:**
- Главная страница: http://localhost:8001/test/
- Страница главы: http://localhost:8001/test/chapter.html
- Страница теста: http://localhost:8001/test/test.html

**Подробнее:** см. `test/README.md`

## Генерация курса

### Как запустить генерацию всего курса

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
 
Для валидации результатов и сборки final.json используй make validate-all.
```

### Как продолжить генерацию

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
- `scripts/` — вспомогательные скрипты для сборки и валидации

## Рабочий процесс

1. **Генерация глав** — используйте промпты в Cursor для генерации глав
2. **Сборка final.json** — `make final` для пересборки финальных версий глав
3. **Валидация** — `make validate-all` для проверки всех глав
4. **Просмотр в админке** — `make admin` для проверки результатов
5. **Тестирование** — `make test` для проверки пользовательского опыта
