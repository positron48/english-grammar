# Makefile для управления проектом english-grammar

.PHONY: help final validate-all clean

# Находим все главы
CHAPTERS := $(shell find chapters -mindepth 1 -maxdepth 1 -type d -not -name '.*' | sed 's|chapters/||' | sort)

help:
	@echo "Доступные команды:"
	@echo "  make final          - Пересобрать все final.json для всех глав"
	@echo "  make validate-all    - Валидировать все главы"
	@echo "  make clean           - Удалить временные файлы"
	@echo ""
	@echo "Найдено глав: $(words $(CHAPTERS))"
	@echo "$(foreach ch,$(CHAPTERS),  - $(ch)$(newline))"

# Пересобрать все final.json
final:
	@echo "Пересборка final.json для всех глав..."
	@for chapter in $(CHAPTERS); do \
		bash scripts/assemble-chapter.sh $$chapter > /dev/null 2>&1 || echo "  ✗ Ошибка при сборке $$chapter"; \
	done
	@echo "✓ Пересборка завершена"

# Валидировать все главы
validate-all:
	@for chapter in $(CHAPTERS); do \
		bash scripts/validate-chapter.sh $$chapter; \
	done

# Очистка временных файлов
clean:
	@echo "Очистка временных файлов..."
	@find . -type f -name "*.tmp" -delete
	@find . -type f -name "*~" -delete
	@echo "✓ Очистка завершена"
