#!/bin/bash

# Script to populate Vault with memo-app secrets
# Usage: ./scripts/setup-memo-app-secrets.sh

set -e

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root}"

echo "Setting up memo-app secrets in Vault..."

# Function to generate secure password
generate_password() {
  openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Generate passwords
DEV_POSTGRES_PASSWORD=$(generate_password)
DEV_MINIO_PASSWORD=$(generate_password)
STAGING_POSTGRES_PASSWORD=$(generate_password)
STAGING_MINIO_PASSWORD=$(generate_password)
PROD_POSTGRES_PASSWORD=$(generate_password)
PROD_MINIO_PASSWORD=$(generate_password)

# Get Mistral API key from environment or prompt
MISTRAL_API_KEY="${MISTRAL_API_KEY:-}"
if [ -z "$MISTRAL_API_KEY" ]; then
  read -p "Enter Mistral API Key: " MISTRAL_API_KEY
fi

# Dev environment
echo "Creating dev secrets..."
kubectl -n vault exec -i vault-0 -- sh -c "VAULT_ADDR=$VAULT_ADDR VAULT_TOKEN=$VAULT_TOKEN vault kv put secret/memo-app/dev \
  postgres-user=postgres \
  postgres-password='${DEV_POSTGRES_PASSWORD}' \
  database-url='postgresql://postgres:${DEV_POSTGRES_PASSWORD}@dev-postgres:5432/memo' \
  minio-root-user=minioadmin \
  minio-root-password='${DEV_MINIO_PASSWORD}' \
  mistral-api-key='${MISTRAL_API_KEY}'"

# Staging environment
echo "Creating staging secrets..."
kubectl -n vault exec -i vault-0 -- sh -c "VAULT_ADDR=$VAULT_ADDR VAULT_TOKEN=$VAULT_TOKEN vault kv put secret/memo-app/staging \
  postgres-user=postgres \
  postgres-password='${STAGING_POSTGRES_PASSWORD}' \
  database-url='postgresql://postgres:${STAGING_POSTGRES_PASSWORD}@staging-postgres:5432/memo' \
  minio-root-user=minioadmin \
  minio-root-password='${STAGING_MINIO_PASSWORD}' \
  mistral-api-key='${MISTRAL_API_KEY}'"

# Production environment
echo "Creating production secrets..."
kubectl -n vault exec -i vault-0 -- sh -c "VAULT_ADDR=$VAULT_ADDR VAULT_TOKEN=$VAULT_TOKEN vault kv put secret/memo-app/production \
  postgres-user=postgres \
  postgres-password='${PROD_POSTGRES_PASSWORD}' \
  database-url='postgresql://postgres:${PROD_POSTGRES_PASSWORD}@prod-postgres:5432/memo' \
  minio-root-user=minioadmin \
  minio-root-password='${PROD_MINIO_PASSWORD}' \
  mistral-api-key='${MISTRAL_API_KEY}'"

echo "✅ Memo-app secrets created successfully!"
echo ""
echo "⚠️  IMPORTANT: Save these credentials securely!"
echo ""
echo "Dev PostgreSQL password: ${DEV_POSTGRES_PASSWORD}"
echo "Dev MinIO password: ${DEV_MINIO_PASSWORD}"
echo "Staging PostgreSQL password: ${STAGING_POSTGRES_PASSWORD}"
echo "Staging MinIO password: ${STAGING_MINIO_PASSWORD}"
echo "Production PostgreSQL password: ${PROD_POSTGRES_PASSWORD}"
echo "Production MinIO password: ${PROD_MINIO_PASSWORD}"
