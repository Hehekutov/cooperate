# cooperate

## Docker

Сборка одного образа:

```bash
docker build -t cooperate .
```

Запуск контейнера:

```bash
docker run --rm -p 8080:80 cooperate
```

Фронтенд будет доступен на `http://localhost:8080`, а запросы к `/api` и `/health` будут проксироваться на встроенный backend-процесс внутри того же контейнера.

Если хочешь сохранить данные между перезапусками, примонтируй volume в `/app/data`.
