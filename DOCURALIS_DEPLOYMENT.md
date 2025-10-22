# Docuralis Deployment Guide

Complete guide for deploying the Docuralis application to K3s with ArgoCD, Vault secrets, and GitOps.

## Overview

Docuralis is a unified Next.js application that combines frontend and backend functionality into a single deployment. It replaces the previous separate backend (Rust/Python) and frontend applications.

### Architecture

- **Application**: Next.js 16 (React 19) with TypeScript
- **Database**: PostgreSQL with pgvector extension
- **Object Storage**: MinIO (S3-compatible)
- **Vector Database**: Qdrant
- **Secrets Management**: HashiCorp Vault with External Secrets Operator
- **CI/CD**: GitHub Actions + ArgoCD
- **Ingress**: Traefik with Let's Encrypt TLS
- **DNS**: External DNS with Cloudflare

## Prerequisites

Before deploying Docuralis, ensure the following are set up:

1. ✅ K3s cluster running
2. ✅ ArgoCD installed and configured
3. ✅ Vault installed and unsealed
4. ✅ External Secrets Operator installed
5. ✅ cert-manager configured with Let's Encrypt
6. ✅ ExternalDNS configured with Cloudflare
7. ✅ PostgreSQL deployed with pgvector
8. ✅ MinIO deployed
9. ✅ Qdrant deployed

## Step 1: Set Up Infrastructure Secrets

### 1.1 Login to Vault

```bash
export VAULT_ADDR='https://vault.huberty.pro'
vault login
# Enter your root token from VAULT_CREDENTIALS.md
```

### 1.2 Create Infrastructure Secrets

```bash
# PostgreSQL Configuration
vault kv put secret/infrastructure/postgresql \
  host="postgresql.database" \
  port="5432" \
  user="rag_admin" \
  password="CHANGE_THIS_SECURE_PASSWORD"

# MinIO Configuration
vault kv put secret/infrastructure/minio \
  endpoint="minio.storage:9000" \
  access_key="minioadmin" \
  secret_key="CHANGE_THIS_SECURE_PASSWORD"

# Qdrant Configuration
vault kv put secret/infrastructure/qdrant \
  url="http://qdrant.database:6334" \
  api_key=""
```

## Step 2: Set Up Docuralis Secrets

### 2.1 Development Environment

```bash
vault kv put secret/docuralis/dev \
  database_url="postgresql://rag_admin:PASSWORD@postgresql.database:5432/docuralis_dev" \
  nextauth_secret="$(openssl rand -base64 32)"
```

### 2.2 Staging Environment

```bash
vault kv put secret/docuralis/staging \
  database_url="postgresql://rag_admin:PASSWORD@postgresql.database:5432/docuralis_staging" \
  nextauth_secret="$(openssl rand -base64 32)"
```

### 2.3 Production Environment

```bash
vault kv put secret/docuralis/production \
  database_url="postgresql://rag_admin:SECURE_PASSWORD@postgresql.database:5432/docuralis" \
  nextauth_secret="$(openssl rand -base64 32)"
```

### 2.4 OAuth Provider Credentials

Set up OAuth applications with your providers first, then add credentials:

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

### 2.5 API Keys

```bash
vault kv put secret/docuralis/api-keys \
  openai_api_key="YOUR_OPENAI_API_KEY"
```

### 2.6 SMTP Configuration (Optional)

```bash
vault kv put secret/docuralis/smtp \
  smtp_host="smtp.gmail.com" \
  smtp_port="587" \
  smtp_user="your-email@gmail.com" \
  smtp_password="your-app-password" \
  smtp_from="noreply@huberty.pro"
```

## Step 3: Create Kubernetes Namespaces

```bash
kubectl create namespace dev --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace staging --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -
```

## Step 4: Apply ExternalSecrets

```bash
kubectl apply -f infra/apps/docuralis/external-secrets.yaml
```

### Verify Secrets Sync

```bash
# Check ExternalSecret status
kubectl get externalsecrets -n dev
kubectl get externalsecrets -n staging
kubectl get externalsecrets -n production

# Verify secrets were created
kubectl get secrets docuralis-secrets -n dev
kubectl describe secret docuralis-secrets -n dev
```

## Step 5: Set Up GitHub Container Registry

### 5.1 Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a token with `write:packages` permission
3. Copy the token

### 5.2 Create Image Pull Secret

```bash
# For each namespace
for ns in dev staging production; do
  kubectl create secret docker-registry ghcr-credentials \
    --docker-server=ghcr.io \
    --docker-username=YOUR_GITHUB_USERNAME \
    --docker-password=YOUR_GITHUB_TOKEN \
    --docker-email=your-email@example.com \
    --namespace=$ns \
    --dry-run=client -o yaml | kubectl apply -f -
done
```

## Step 6: Initialize Databases

### 6.1 Create Databases

```bash
# Connect to PostgreSQL
kubectl exec -it -n database deployment/postgresql -- psql -U rag_admin -d postgres

# In the PostgreSQL shell:
CREATE DATABASE docuralis_dev;
CREATE DATABASE docuralis_staging;
CREATE DATABASE docuralis;

# Enable pgvector extension for each database
\c docuralis_dev
CREATE EXTENSION IF NOT EXISTS vector;

\c docuralis_staging
CREATE EXTENSION IF NOT EXISTS vector;

\c docuralis
CREATE EXTENSION IF NOT EXISTS vector;

\q
```

### 6.2 Run Prisma Migrations

You'll need to run migrations after the first deployment. See "Step 9: Run Database Migrations" below.

## Step 7: Push Code to GitHub

Ensure your code is pushed to the correct branches:

```bash
# Push to dev branch
git checkout dev
git add .
git commit -m "Deploy Docuralis to dev"
git push origin dev

# Push to staging branch
git checkout staging
git add .
git commit -m "Deploy Docuralis to staging"
git push origin staging

# Push to main branch
git checkout main
git add .
git commit -m "Deploy Docuralis to production"
git push origin main
```

## Step 8: Deploy with ArgoCD

### 8.1 Apply ArgoCD Applications

```bash
# Apply the app-of-apps
kubectl apply -f infra/argocd/app-of-apps.yaml

# Verify applications are created
kubectl get applications -n argocd
```

### 8.2 Sync Applications

```bash
# Sync dev environment
argocd app sync docuralis-dev

# Sync staging environment
argocd app sync docuralis-staging

# Sync production environment (manual approval recommended)
argocd app sync docuralis-production
```

### 8.3 Monitor Deployment

```bash
# Watch ArgoCD applications
kubectl get applications -n argocd -w

# Check deployment status
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n production

# View logs
kubectl logs -n dev -l app=docuralis --tail=100 -f
```

## Step 9: Run Database Migrations

After the first deployment, run Prisma migrations:

```bash
# For dev environment
kubectl exec -it -n dev deployment/dev-docuralis -- npx prisma migrate deploy

# For staging environment
kubectl exec -it -n staging deployment/staging-docuralis -- npx prisma migrate deploy

# For production environment
kubectl exec -it -n production deployment/prod-docuralis -- npx prisma migrate deploy
```

## Step 10: Verify Deployment

### 10.1 Check DNS Records

```bash
# Verify DNS records were created
dig dev.huberty.pro
dig staging.huberty.pro
dig app.huberty.pro
```

### 10.2 Check TLS Certificates

```bash
# Check certificate status
kubectl get certificates -n dev
kubectl get certificates -n staging
kubectl get certificates -n production

# Describe certificate for details
kubectl describe certificate docuralis-dev-tls -n dev
```

### 10.3 Test Applications

- **Dev**: https://dev.huberty.pro
- **Staging**: https://staging.huberty.pro
- **Production**: https://app.huberty.pro

### 10.4 Health Checks

```bash
# Test health endpoints
curl https://dev.huberty.pro/api/health
curl https://staging.huberty.pro/api/health
curl https://app.huberty.pro/api/health
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline is defined in `.github/workflows/docuralis.yml`:

1. **Lint and Test**: Runs on all pushes and PRs
   - ESLint
   - Prettier
   - Jest tests with coverage

2. **Build and Push**: Runs on push to main/dev/staging
   - Builds Docker image
   - Pushes to ghcr.io
   - Tags: branch name, SHA, latest (for main)

3. **Deploy**: Automatic via ArgoCD
   - ArgoCD watches the repository
   - Auto-syncs on new commits
   - Applies environment-specific configuration

### Branch Strategy

- `dev` → Dev environment (auto-deploy)
- `staging` → Staging environment (auto-deploy)
- `main` → Production environment (auto-deploy with self-heal, manual prune)

## Monitoring and Troubleshooting

### View Application Logs

```bash
# Dev environment
kubectl logs -n dev -l app=docuralis --tail=100 -f

# Staging environment
kubectl logs -n staging -l app=docuralis --tail=100 -f

# Production environment
kubectl logs -n production -l app=docuralis --tail=100 -f
```

### Check Pod Status

```bash
kubectl get pods -n dev
kubectl describe pod <pod-name> -n dev
```

### Check External Secrets

```bash
# Check ExternalSecret sync status
kubectl get externalsecrets -n dev
kubectl describe externalsecret docuralis-secrets -n dev

# Check if secret exists
kubectl get secret docuralis-secrets -n dev
```

### Check Ingress

```bash
kubectl get ingress -n dev
kubectl describe ingress docuralis-ingress -n dev
```

### Common Issues

#### 1. ImagePullBackOff

```bash
# Check if image pull secret exists
kubectl get secret ghcr-credentials -n dev

# Recreate if needed
kubectl delete secret ghcr-credentials -n dev
# Then create it again (see Step 5.2)
```

#### 2. ExternalSecret Not Syncing

```bash
# Check External Secrets Operator logs
kubectl logs -n external-secrets -l app.kubernetes.io/name=external-secrets

# Check SecretStore
kubectl get secretstore -n dev
kubectl describe secretstore vault-secret-store
```

#### 3. Database Connection Issues

```bash
# Test database connectivity from pod
kubectl exec -it -n dev deployment/dev-docuralis -- sh
# Inside pod:
nc -zv postgresql.database 5432
```

#### 4. Certificate Issues

```bash
# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager

# Check certificate request
kubectl get certificaterequest -n dev
kubectl describe certificaterequest <name> -n dev
```

## Rollback Procedure

### Using ArgoCD

```bash
# View application history
argocd app history docuralis-production

# Rollback to previous version
argocd app rollback docuralis-production <revision-number>
```

### Using kubectl

```bash
# Rollback deployment
kubectl rollout undo deployment/prod-docuralis -n production

# View rollout history
kubectl rollout history deployment/prod-docuralis -n production
```

## Scaling

### Manual Scaling

```bash
# Scale dev environment
kubectl scale deployment/dev-docuralis --replicas=2 -n dev

# Scale staging
kubectl scale deployment/staging-docuralis --replicas=3 -n staging

# Scale production
kubectl scale deployment/prod-docuralis --replicas=5 -n production
```

### Update Replica Count in Git

Edit the appropriate patch file:
- Dev: `infra/environments/dev/docuralis-patch.yaml`
- Staging: `infra/environments/staging/docuralis-patch.yaml`
- Production: `infra/environments/production/docuralis-patch.yaml`

Then commit and push. ArgoCD will auto-sync.

## Updating the Application

1. Make changes to code
2. Commit to appropriate branch
3. Push to GitHub
4. GitHub Actions builds and pushes new image
5. ArgoCD detects new image and syncs automatically

## Security Considerations

1. **Change default passwords**: Update all default credentials in production
2. **Rotate secrets regularly**: Implement secret rotation policy
3. **Use RBAC**: Limit access to namespaces and resources
4. **Enable network policies**: Restrict pod-to-pod communication
5. **Regular updates**: Keep dependencies and images up to date
6. **Backup databases**: Implement regular backup strategy
7. **Monitor logs**: Set up alerting for errors and anomalies

## Next Steps

1. Set up monitoring with Prometheus and Grafana
2. Configure log aggregation with Loki
3. Implement horizontal pod autoscaling (HPA)
4. Set up database backups with Velero
5. Configure alerting with Alertmanager
6. Implement rate limiting and WAF rules
7. Set up disaster recovery procedures

## Support

For issues or questions:
- Check ArgoCD UI: https://argocd.huberty.pro
- Check Grafana: https://grafana.huberty.pro
- Check Vault: https://vault.huberty.pro
- Review logs in Loki or kubectl

## References

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [External Secrets Documentation](https://external-secrets.io/)
- [Vault Documentation](https://www.vaultproject.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
