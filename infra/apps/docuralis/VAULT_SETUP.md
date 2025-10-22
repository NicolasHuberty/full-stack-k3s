# Vault Setup for Docuralis

This document explains how to set up secrets in Vault for the Docuralis application.

## Prerequisites

1. Vault is installed and running
2. You have the root token from `VAULT_CREDENTIALS.md`
3. You are authenticated to Vault

## Login to Vault

```bash
export VAULT_ADDR='https://vault.huberty.pro'
vault login
# Enter your root token when prompted
```

## Create Secrets Structure

### 1. Development Environment Secrets

```bash
# Database URL for dev
vault kv put secret/docuralis/dev \
  database_url="postgresql://rag_admin:changeme123@postgresql.database:5432/docuralis_dev" \
  nextauth_secret="$(openssl rand -base64 32)"

# Staging Environment
vault kv put secret/docuralis/staging \
  database_url="postgresql://rag_admin:changeme123@postgresql.database:5432/docuralis_staging" \
  nextauth_secret="$(openssl rand -base64 32)"

# Production Environment
vault kv put secret/docuralis/production \
  database_url="postgresql://rag_admin:CHANGE_THIS_PASSWORD@postgresql.database:5432/docuralis" \
  nextauth_secret="$(openssl rand -base64 32)"
```

### 2. OAuth Provider Secrets

```bash
vault kv put secret/docuralis/oauth \
  google_client_id="YOUR_GOOGLE_CLIENT_ID" \
  google_client_secret="YOUR_GOOGLE_CLIENT_SECRET" \
  github_client_id="YOUR_GITHUB_CLIENT_ID" \
  github_client_secret="YOUR_GITHUB_CLIENT_SECRET" \
  azure_ad_client_id="YOUR_AZURE_AD_CLIENT_ID" \
  azure_ad_client_secret="YOUR_AZURE_AD_CLIENT_SECRET" \
  azure_ad_tenant_id="YOUR_AZURE_AD_TENANT_ID"
```

### 3. Infrastructure Secrets

```bash
# MinIO Configuration
vault kv put secret/infrastructure/minio \
  endpoint="minio.storage:9000" \
  access_key="minioadmin" \
  secret_key="minioadmin123"

# Qdrant Configuration
vault kv put secret/infrastructure/qdrant \
  url="http://qdrant.database:6334" \
  api_key=""
```

### 4. API Keys

```bash
vault kv put secret/docuralis/api-keys \
  openai_api_key="YOUR_OPENAI_API_KEY"
```

### 5. SMTP Configuration (Optional)

```bash
vault kv put secret/docuralis/smtp \
  smtp_host="smtp.gmail.com" \
  smtp_port="587" \
  smtp_user="your-email@gmail.com" \
  smtp_password="your-app-password" \
  smtp_from="noreply@huberty.pro"
```

## Verify Secrets

```bash
# List all secrets
vault kv list secret/docuralis

# Read specific secret
vault kv get secret/docuralis/dev
vault kv get secret/docuralis/oauth
vault kv get secret/infrastructure/minio
vault kv get secret/infrastructure/qdrant
```

## Update Infrastructure Secrets

If you need to update PostgreSQL, MinIO, or Qdrant credentials:

### Update PostgreSQL Secret

```bash
# Update the PostgreSQL secret in K8s
kubectl create secret generic postgresql-secret \
  --from-literal=POSTGRES_USER=rag_admin \
  --from-literal=POSTGRES_PASSWORD=NEW_SECURE_PASSWORD \
  --from-literal=POSTGRES_DB=docuralis \
  --namespace=database \
  --dry-run=client -o yaml | kubectl apply -f -

# Update Vault with new DATABASE_URL
vault kv put secret/docuralis/production \
  database_url="postgresql://rag_admin:NEW_SECURE_PASSWORD@postgresql.database:5432/docuralis"
```

### Update MinIO Credentials

```bash
# Update MinIO secret
kubectl create secret generic minio-secret \
  --from-literal=MINIO_ROOT_USER=NEW_ADMIN_USER \
  --from-literal=MINIO_ROOT_PASSWORD=NEW_SECURE_PASSWORD \
  --namespace=storage \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart MinIO
kubectl rollout restart deployment/minio -n storage

# Update Vault
vault kv put secret/infrastructure/minio \
  endpoint="minio.storage:9000" \
  access_key="NEW_ADMIN_USER" \
  secret_key="NEW_SECURE_PASSWORD"
```

## Apply ExternalSecrets

After populating Vault, apply the ExternalSecrets:

```bash
kubectl apply -f /Users/nicolas/Documents/k3s-app/infra/apps/docuralis/external-secrets.yaml
```

## Verify ExternalSecrets Sync

```bash
# Check ExternalSecret status
kubectl get externalsecrets -n dev
kubectl get externalsecrets -n staging
kubectl get externalsecrets -n production

# Verify secrets were created
kubectl get secrets docuralis-secrets -n dev
kubectl describe secret docuralis-secrets -n dev
```

## Troubleshooting

If secrets are not syncing:

```bash
# Check External Secrets Operator logs
kubectl logs -n external-secrets -l app.kubernetes.io/name=external-secrets

# Check ExternalSecret events
kubectl describe externalsecret docuralis-secrets -n dev

# Verify Vault connectivity from cluster
kubectl run vault-test --rm -it --image=vault:latest -- sh
# Inside the container:
export VAULT_ADDR='http://vault.vault:8200'
vault status
```

## Security Best Practices

1. **Change default passwords**: Update all default passwords in production
2. **Rotate secrets regularly**: Implement a secret rotation policy
3. **Use strong passwords**: Generate passwords with `openssl rand -base64 32`
4. **Limit access**: Use Vault policies to restrict access to secrets
5. **Enable audit logging**: Track who accesses secrets in Vault
6. **Backup Vault data**: Regularly backup Vault storage backend

## Next Steps

1. Set up OAuth applications with providers (Google, GitHub, Azure AD)
2. Get OpenAI API key
3. Configure SMTP for email notifications
4. Update production database passwords
5. Apply ExternalSecrets to all environments
