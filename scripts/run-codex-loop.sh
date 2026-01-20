#!/bin/bash

# Скрипт для бесконечного запуска codex exec с паузой между запусками
# Использование: ./scripts/run-codex-loop.sh

# Цветовые коды ANSI
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
BOLD='\033[1m'
RESET='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPT_FILE="$PROJECT_ROOT/prompts/0-master-prompt.md"
PAUSE_SECONDS=10
ITERATION=1

# Обработка Ctrl+C для корректного завершения
trap 'echo ""; echo -e "${RED}🛑 Остановка цикла...${RESET}"; exit 0' INT TERM

cd "$PROJECT_ROOT" || exit 1

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${CYAN}🔄 Запуск бесконечного цикла codex exec${RESET}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "${BLUE}Промпт:${RESET} ${GRAY}$PROMPT_FILE${RESET}"
echo -e "${BLUE}Пауза между запусками:${RESET} ${YELLOW}${PAUSE_SECONDS} секунд${RESET}"
echo -e "${GRAY}Для остановки нажмите Ctrl+C${RESET}"
echo ""

while true; do
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${BOLD}${MAGENTA}🔄 Итерация #$ITERATION${RESET} ${GRAY}- $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    
    # Запуск codex exec
    codex exec --full-auto "run $PROMPT_FILE"
    
    EXIT_CODE=$?
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Итерация #$ITERATION завершена успешно${RESET}"
    else
        echo -e "${YELLOW}⚠️  Итерация #$ITERATION завершена с кодом ошибки: ${RED}$EXIT_CODE${RESET}"
    fi
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    
    # Пауза перед следующим запуском
    echo -e "${GRAY}⏳ Пауза ${YELLOW}${PAUSE_SECONDS} секунд${GRAY} перед следующей итерацией...${RESET}"
    echo ""
    sleep $PAUSE_SECONDS
    
    ITERATION=$((ITERATION + 1))
done
