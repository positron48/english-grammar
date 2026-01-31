# Docker и деплой

## Локальная сборка

```bash
docker build -t english-grammar:local .
docker run -p 8080:80 english-grammar:local
```

Откройте http://localhost:8080/test/

## CI (GitHub Actions)

При push в `master` образ собирается и пушится в `ghcr.io/<owner>/<repo>`.

Убедитесь, что в настройках репозитория включён доступ Packages (Settings → Actions → General → Workflow permissions: Read and write).

## Переменные для Git push из админки

В k8s (Deployment) задаются через env:

- `GITHUB_TOKEN` — PAT с правом `contents: write`
- `GITHUB_OWNER` — владелец репо (например, positron48)
- `GITHUB_REPO` — имя репо (например, english-grammar)

При сохранении через админку изменения пушатся в Git; CI пересоберёт образ.
