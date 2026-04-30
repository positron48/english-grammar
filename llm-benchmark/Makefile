.PHONY: help bench bench-all bench-fast bench-ollama bench-llamacpp bench-spec bench-parallel show-latest

PY ?= python3
SCRIPT := benchmark.py

help:
	@echo "LLM benchmark commands:"
	@echo "  make bench-all         - run all scenarios from scenarios.json"
	@echo "  make bench-fast        - run all scenarios on 1 task (quick smoke)"
	@echo "  make bench SCENARIO=x  - run one scenario by name"
	@echo "  make bench-ollama      - run ollama-seq"
	@echo "  make bench-llamacpp    - run llamacpp-seq"
	@echo "  make bench-spec        - run llamacpp-speculative-seq"
	@echo "  make bench-parallel    - run llamacpp-parallel4"
	@echo "  make show-latest       - print latest summary.md path"

bench-all:
	@$(PY) $(SCRIPT) --course-root .. --scenarios scenarios.json --tasks tasks.json

bench-fast:
	@$(PY) $(SCRIPT) --course-root .. --scenarios scenarios.json --tasks tasks-fast.json

bench:
	@if [ -z "$(SCENARIO)" ]; then \
		echo "Usage: make bench SCENARIO=<name>"; \
		exit 1; \
	fi
	@$(PY) $(SCRIPT) --course-root .. --scenarios scenarios.json --tasks tasks.json --only "$(SCENARIO)"

bench-ollama:
	@$(MAKE) bench SCENARIO=ollama-seq

bench-llamacpp:
	@$(MAKE) bench SCENARIO=llamacpp-seq

bench-spec:
	@$(MAKE) bench SCENARIO=llamacpp-speculative-seq

bench-parallel:
	@$(MAKE) bench SCENARIO=llamacpp-parallel4

show-latest:
	@LATEST=$$(ls -1dt results/* 2>/dev/null | head -n 1); \
	if [ -z "$$LATEST" ]; then \
		echo "No benchmark results yet"; \
		exit 1; \
	fi; \
	echo "$$LATEST/summary.md"
