# Database Migrations

This directory contains SQL migration files for the database schema.

## Migrations

1. `001_create_users.sql` - Initial users table with authentication
2. `002_create_files_and_embeddings.sql` - Files and vector embeddings for RAG
3. `003_create_memos.sql` - Memos tables for conversation-based notes

## Running Migrations

Migrations are currently run manually. To execute a migration:

```bash
# Get the PostgreSQL pod name
export KUBECONFIG=./kubeconfig.yml
kubectl get pods -n database | grep postgresql

# Execute migration
kubectl exec -i <postgresql-pod-name> -n database -- psql -U rag_admin -d rag_database < migrations/xxx_migration_name.sql
```

### Migration 003 - Memos Tables

Executed on: 2025-10-16

Creates three tables:
- `memos` - Main memo entries with title and description
- `memo_messages` - Chat messages within memos (user and assistant roles)
- `memo_attachments` - Links between messages and uploaded files

All tables include proper foreign keys, indexes, and cascade delete rules.
