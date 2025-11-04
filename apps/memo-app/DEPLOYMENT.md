# Memo App Deployment Guide

This document provides instructions for deploying the Memo App to Kubernetes using GitOps with ArgoCD.

## Architecture

The Memo App consists of:
- **Frontend**: Next.js application with Prisma ORM
- **Worker**: Background job processor using BullMQ
- **PostgreSQL**: Database for application data
- **Redis**: Queue backend for BullMQ
- **MinIO**: S3-compatible object storage for files

## Environments

The application is deployed to three environments:
- **Dev**: `dev.memo.docuralis.com` - Auto-sync enabled, 1 replica
- **Staging**: `staging.memo.docuralis.com` - Auto-sync enabled, 2 replicas
- **Production**: `memo.docuralis.com` - Manual sync required, 3 replicas

## Prerequisites

1. K3s cluster with the following components:
   - ArgoCD
   - Cert-Manager (Let's Encrypt)
   - ExternalDNS (Cloudflare)
   - External Secrets Operator
   - Vault (for secrets management)
   - MetalLB (load balancer)

2. GitHub Container Registry access configured
3. Cloudflare DNS configured for `*.memo.docuralis.com`

## Secrets Setup

Before deploying, you need to populate Vault with the required secrets:

```bash
# Set your Vault address and token
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="your-vault-root-token"
export MISTRAL_API_KEY="your-mistral-api-key"

# Run the secrets setup script
./scripts/setup-memo-app-secrets.sh
```

The script will create secrets for all three environments:
- `secret/memo-app/dev`
- `secret/memo-app/staging`
- `secret/memo-app/production`

Each environment requires:
- `postgres-user`: PostgreSQL username
- `postgres-password`: PostgreSQL password
- `database-url`: Full PostgreSQL connection string
- `minio-root-user`: MinIO access key
- `minio-root-password`: MinIO secret key
- `mistral-api-key`: Mistral AI API key for transcription

## Deployment Steps

### 1. Push Code to GitHub

```bash
# Commit all changes
git add .
git commit -m "Add memo-app deployment configuration"

# Push to dev branch
git push origin dev

# Push to main branch for staging/production
git checkout main
git merge dev
git push origin main
```

### 2. Deploy ArgoCD Applications

```bash
# Deploy dev environment
kubectl apply -f argocd/apps/memo-app-dev.yaml

# Deploy staging environment
kubectl apply -f argocd/apps/memo-app-staging.yaml

# Deploy production environment (manual sync)
kubectl apply -f argocd/apps/memo-app-production.yaml
```

### 3. Verify Deployment

```bash
# Check ArgoCD application status
kubectl -n argocd get applications

# Check dev environment pods
kubectl -n memo-app-dev get pods

# Check staging environment pods
kubectl -n memo-app-staging get pods

# Check production environment pods
kubectl -n memo-app-production get pods
```

### 4. Access the Applications

- **Dev**: https://dev.memo.docuralis.com
- **Staging**: https://staging.memo.docuralis.com
- **Production**: https://memo.docuralis.com

## CI/CD Pipeline

GitHub Actions workflow is configured at `.github/workflows/memo-app.yml`:

1. **On push to `dev` branch**:
   - Builds Docker images tagged with `dev`
   - Pushes to GitHub Container Registry
   - ArgoCD auto-syncs dev environment

2. **On push to `main` branch**:
   - Builds Docker images tagged with `staging` and `production`
   - Pushes to GitHub Container Registry
   - ArgoCD auto-syncs staging environment
   - Production requires manual sync for safety

### Manual Production Deployment

```bash
# Sync production environment
kubectl -n argocd exec -it <argocd-server-pod> -- \
  argocd app sync memo-app-production

# Or use ArgoCD UI
# Navigate to https://argocd.huberty.pro
# Click on memo-app-production
# Click "SYNC"
```

## Database Migrations

Database migrations run automatically via an init container in the frontend deployment. The init container runs `npx prisma migrate deploy` before starting the application.

## Monitoring

- Check application logs: `kubectl -n memo-app-<env> logs -f deployment/<prefix>-memo-frontend`
- Check worker logs: `kubectl -n memo-app-<env> logs -f deployment/<prefix>-memo-worker`
- Check queue health: `https://<env>.memo.docuralis.com/api/queue/health`

## Troubleshooting

### ExternalSecret not syncing

```bash
# Check ExternalSecret status
kubectl -n memo-app-<env> get externalsecrets

# Check secret creation
kubectl -n memo-app-<env> get secrets memo-secrets

# Check external-secrets-operator logs
kubectl -n external-secrets logs -l app.kubernetes.io/name=external-secrets
```

### Pods not starting

```bash
# Check pod status
kubectl -n memo-app-<env> get pods

# Describe pod for events
kubectl -n memo-app-<env> describe pod <pod-name>

# Check logs
kubectl -n memo-app-<env> logs <pod-name>
```

### Database connection issues

```bash
# Check postgres pod
kubectl -n memo-app-<env> get pods -l app=postgres

# Test database connection
kubectl -n memo-app-<env> exec -it <prefix>-postgres-0 -- psql -U postgres -d memo
```

### MinIO bucket not created

```bash
# Check minio-setup job
kubectl -n memo-app-<env> get jobs

# Check job logs
kubectl -n memo-app-<env> logs job/<prefix>-minio-setup
```

## Scaling

### Manual scaling

```bash
# Scale frontend
kubectl -n memo-app-<env> scale deployment/<prefix>-memo-frontend --replicas=5

# Scale worker
kubectl -n memo-app-<env> scale deployment/<prefix>-memo-worker --replicas=5
```

### Update Kustomize overlays for permanent changes

Edit the appropriate overlay file:
- Dev: `k8s/memo-app/overlays/dev/replica-patch.yaml`
- Staging: `k8s/memo-app/overlays/staging/replica-patch.yaml`
- Production: `k8s/memo-app/overlays/production/replica-patch.yaml`

Commit and push to trigger ArgoCD sync.

## Backup and Restore

### PostgreSQL Backup

```bash
# Backup database
kubectl -n memo-app-production exec <prefix>-postgres-0 -- \
  pg_dump -U postgres memo > memo-backup-$(date +%Y%m%d).sql

# Restore database
kubectl -n memo-app-production exec -i <prefix>-postgres-0 -- \
  psql -U postgres memo < memo-backup-20241104.sql
```

### MinIO Backup

Use MinIO client (mc) to backup objects:

```bash
# Port forward MinIO
kubectl -n memo-app-production port-forward svc/<prefix>-minio 9000:9000

# Configure mc
mc alias set myminio http://localhost:9000 minioadmin <password>

# Backup bucket
mc mirror myminio/memo ./memo-backup/
```

## Rollback

### Rollback deployment

```bash
# Check rollout history
kubectl -n memo-app-<env> rollout history deployment/<prefix>-memo-frontend

# Rollback to previous version
kubectl -n memo-app-<env> rollout undo deployment/<prefix>-memo-frontend

# Rollback to specific revision
kubectl -n memo-app-<env> rollout undo deployment/<prefix>-memo-frontend --to-revision=2
```

### Rollback via ArgoCD

1. Navigate to ArgoCD UI
2. Select the application
3. Click on "HISTORY AND ROLLBACK"
4. Select the desired revision
5. Click "ROLLBACK"

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [BullMQ Documentation](https://docs.bullmq.io)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io)
- [Kustomize Documentation](https://kustomize.io)
