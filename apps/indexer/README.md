# @sovereign-sdk/indexer

A indexer for Sovereign SDK rollups.

## Develop

```bash
docker pull postgres
```

If you change the password here you will also need to ensure it's changed in the `dev` npm script.

```bash
docker run --name sov-indexer-db -e POSTGRES_PASSWORD=admin123 -d -p 5432:5432 postgres
```

```bash
docker start sov-indexer-db
```

```bash
docker exec -i sov-indexer-db psql -U postgres < ./db/create_events_table.sql
```
