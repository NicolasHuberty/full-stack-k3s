# Migration Summary: Backend/Frontend → Docuralis

This document summarizes the migration from separate backend/frontend applications to the unified Docuralis application.

## Changes Made

### 1. Application Structure

**Before:**
- Separate Rust backend (`apps/backend`)
- Separate Python FastAPI backend (`apps/backend-python`)
- Separate Next.js frontend (`apps/frontend`)

**After:**
- Unified Next.js application (`apps/docuralis`)
- Single codebase handling both frontend and backend (API routes)
- All functionality integrated into one deployment

### 2. New Files Created

#### Docuralis Application
- ✅ `apps/docuralis/Dockerfile` - Multi-stage Docker build for production
- ✅ `apps/docuralis/next.config.ts` - Updated with standalone output
- ✅ `apps/docuralis/src/app/api/health/route.ts` - Health check endpoint

#### CI/CD
- ✅ `.github/workflows/docuralis.yml` - Complete CI/CD pipeline
  - Lint and test job
  - Build and push Docker images to GHCR
  - Auto-deployment triggers for dev/staging/production

#### Kubernetes Manifests
- ✅ `infra/base/docuralis/deployment.yaml` - Base deployment template
- ✅ `infra/base/docuralis/service.yaml` - Service definition
- ✅ `infra/base/docuralis/kustomization.yaml` - Kustomize configuration

#### Environment-Specific Configurations

**Dev Environment:**
- ✅ `infra/environments/dev/docuralis-patch.yaml` - Dev-specific settings
- ✅ `infra/environments/dev/docuralis-ingress.yaml` - Dev ingress (dev.huberty.pro)
- ✅ `infra/environments/dev/kustomization.yaml` - Updated to use Docuralis

**Staging Environment:**
- ✅ `infra/environments/staging/docuralis-patch.yaml` - Staging settings
- ✅ `infra/environments/staging/docuralis-ingress.yaml` - Staging ingress (staging.huberty.pro)
- ✅ `infra/environments/staging/kustomization.yaml` - Updated to use Docuralis

**Production Environment:**
- ✅ `infra/environments/production/docuralis-patch.yaml` - Production settings
- ✅ `infra/environments/production/docuralis-ingress.yaml` - Production ingress (app.huberty.pro)
- ✅ `infra/environments/production/kustomization.yaml` - Updated to use Docuralis

#### Secrets Management
- ✅ `infra/apps/docuralis/external-secrets.yaml` - ExternalSecrets for all environments
- ✅ `infra/apps/docuralis/VAULT_SETUP.md` - Vault configuration guide

#### ArgoCD
- ✅ `argocd/environments/dev-app.yaml` - Dev ArgoCD application
- ✅ `argocd/environments/staging-app.yaml` - Staging ArgoCD application
- ✅ `argocd/environments/production-app.yaml` - Production ArgoCD application

#### Documentation
- ✅ `DOCURALIS_DEPLOYMENT.md` - Complete deployment guide
- ✅ `MIGRATION_SUMMARY.md` - This file

### 3. Files Removed

#### Old Base Configurations
- ❌ `infra/base/backend/` - Entire directory removed
- ❌ `infra/base/frontend/` - Entire directory removed
- ❌ `infra/base/redis/` - Entire directory removed (if not needed)

#### Old Environment Configurations
- ❌ `infra/environments/dev/backend-patch.yaml`
- ❌ `infra/environments/dev/ingress.yaml` (old backend/frontend ingress)
- ❌ `infra/environments/staging/ingress.yaml` (old backend/frontend ingress)
- ❌ `infra/environments/production/ingress.yaml` (old backend/frontend ingress)

### 4. Configuration Changes

#### Environment Variables
The new deployment uses comprehensive environment variables from Vault:

- **Database**: `DATABASE_URL`
- **NextAuth**: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- **OAuth Providers**: Google, GitHub, Azure AD credentials
- **MinIO**: Endpoint, access key, secret key
- **Qdrant**: URL, API key
- **OpenAI**: API key
- **SMTP**: Host, port, user, password, from address

#### Resource Allocation

**Dev:**
- Replicas: 1
- CPU: 200m request, 1000m limit
- Memory: 512Mi request, 1Gi limit

**Staging:**
- Replicas: 2
- CPU: 200m request, 1000m limit
- Memory: 512Mi request, 1Gi limit

**Production:**
- Replicas: 3
- CPU: 200m request, 1000m limit
- Memory: 512Mi request, 1Gi limit

#### Domain Mapping

| Environment | Old Domains | New Domain |
|-------------|-------------|------------|
| Dev | api-dev.huberty.pro, dev.huberty.pro | dev.huberty.pro |
| Staging | api-staging.huberty.pro, staging.huberty.pro | staging.huberty.pro |
| Production | api.huberty.pro, app.huberty.pro | app.huberty.pro |

### 5. Infrastructure Dependencies

All infrastructure components remain the same:

- ✅ **PostgreSQL**: `postgresql.database:5432` (with pgvector)
- ✅ **MinIO**: `minio.storage:9000`
- ✅ **Qdrant**: `qdrant.database:6334`
- ✅ **Vault**: `vault.vault:8200`
- ✅ **ArgoCD**: Managing deployments
- ✅ **cert-manager**: TLS certificates
- ✅ **ExternalDNS**: DNS management
- ✅ **Traefik**: Ingress controller

### 6. Secrets Structure in Vault

```
secret/
├── docuralis/
│   ├── dev/
│   │   ├── database_url
│   │   └── nextauth_secret
│   ├── staging/
│   │   ├── database_url
│   │   └── nextauth_secret
│   ├── production/
│   │   ├── database_url
│   │   └── nextauth_secret
│   ├── oauth/
│   │   ├── google_client_id
│   │   ├── google_client_secret
│   │   ├── github_client_id
│   │   ├── github_client_secret
│   │   ├── azure_ad_client_id
│   │   ├── azure_ad_client_secret
│   │   └── azure_ad_tenant_id
│   ├── api-keys/
│   │   └── openai_api_key
│   └── smtp/
│       ├── smtp_host
│       ├── smtp_port
│       ├── smtp_user
│       ├── smtp_password
│       └── smtp_from
└── infrastructure/
    ├── minio/
    │   ├── endpoint
    │   ├── access_key
    │   └── secret_key
    ├── qdrant/
    │   ├── url
    │   └── api_key
    └── postgresql/
        ├── host
        ├── port
        ├── user
        └── password
```

## Deployment Steps

### Prerequisites
1. Ensure all infrastructure is running (PostgreSQL, MinIO, Qdrant, Vault)
2. Ensure ArgoCD is configured and running
3. Have Vault root token ready

### Step-by-Step Deployment

1. **Set up Vault secrets** (see `infra/apps/docuralis/VAULT_SETUP.md`)
2. **Create namespaces** (dev, staging, production)
3. **Apply ExternalSecrets** to sync Vault secrets to K8s
4. **Create image pull secrets** for GHCR
5. **Initialize databases** (create databases, run migrations)
6. **Push code to GitHub** (dev, staging, main branches)
7. **Apply ArgoCD applications** (app-of-apps pattern)
8. **Verify deployment** (check pods, DNS, TLS, health endpoints)

Detailed instructions are in `DOCURALIS_DEPLOYMENT.md`.

## GitHub Repository Settings

### Required Secrets
None! GitHub Actions uses `GITHUB_TOKEN` automatically for:
- Building Docker images
- Pushing to GitHub Container Registry (ghcr.io)

### Branch Protection (Recommended)

**Main Branch:**
- Require pull request reviews
- Require status checks to pass (lint, test)
- Require branches to be up to date

**Staging Branch:**
- Require pull request reviews (optional)
- Require status checks to pass

**Dev Branch:**
- No protection (fast iteration)

### Container Registry Permissions

Ensure packages are set to public or configure image pull secrets:
```bash
# Repository settings → Packages → Change package visibility
```

## Testing the Migration

### 1. Test CI/CD Pipeline

```bash
# Create a test commit
git checkout dev
echo "test" >> test.txt
git add test.txt
git commit -m "Test CI/CD pipeline"
git push origin dev

# Watch GitHub Actions
# Check: https://github.com/NicolasHuberty/full-stack-k3s/actions
```

### 2. Verify ArgoCD Sync

```bash
# Check ArgoCD UI
# https://argocd.huberty.pro

# Or use CLI
argocd app get docuralis-dev
argocd app get docuralis-staging
argocd app get docuralis-production
```

### 3. Test Application

```bash
# Health checks
curl https://dev.huberty.pro/api/health
curl https://staging.huberty.pro/api/health
curl https://app.huberty.pro/api/health

# Test authentication
# Open browser and test OAuth login
```

## Rollback Plan

If issues occur, you can rollback to the old backend/frontend setup:

### 1. Revert Git Changes

```bash
git checkout main
git revert <commit-hash>
git push origin main
```

### 2. Restore Old Manifests

```bash
# Restore old files from git history
git checkout <old-commit-hash> -- infra/base/backend
git checkout <old-commit-hash> -- infra/base/frontend
git checkout <old-commit-hash> -- infra/environments/*/
git commit -m "Rollback to backend/frontend setup"
git push
```

### 3. Sync ArgoCD

ArgoCD will automatically sync to the old configuration.

## Benefits of the Migration

1. **Simplified Architecture**: Single codebase, single deployment
2. **Reduced Complexity**: No need to manage separate backend/frontend services
3. **Better Developer Experience**: All code in one place
4. **Easier Debugging**: Single set of logs, single deployment
5. **Cost Effective**: Fewer pods to run
6. **Faster Development**: API routes co-located with frontend code
7. **Better Type Safety**: Shared types between frontend and backend

## Known Limitations

1. **Single Point of Failure**: If Next.js app goes down, both frontend and API are unavailable
   - Mitigated by running multiple replicas and health checks
2. **Resource Sharing**: Frontend and API share the same resources
   - Can be mitigated by proper resource limits and horizontal scaling

## Next Steps

1. ✅ Complete Vault secret setup
2. ✅ Apply ExternalSecrets
3. ✅ Create image pull secrets
4. ✅ Initialize databases
5. ✅ Deploy to dev environment first
6. ✅ Test thoroughly in dev
7. ✅ Deploy to staging
8. ✅ Run staging tests
9. ✅ Deploy to production
10. ✅ Monitor and verify production

## Support and Maintenance

### Monitoring
- **ArgoCD**: https://argocd.huberty.pro
- **Grafana**: https://grafana.huberty.pro
- **Vault**: https://vault.huberty.pro

### Logs
```bash
# Application logs
kubectl logs -n production -l app=docuralis -f

# ArgoCD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller

# External Secrets logs
kubectl logs -n external-secrets -l app.kubernetes.io/name=external-secrets
```

### Health Checks
- Dev: https://dev.huberty.pro/api/health
- Staging: https://staging.huberty.pro/api/health
- Production: https://app.huberty.pro/api/health

## Conclusion

The migration consolidates the application stack into a single, manageable Next.js application with comprehensive CI/CD, secrets management, and GitOps workflows. All infrastructure dependencies (PostgreSQL, MinIO, Qdrant, Vault) remain unchanged and are accessed via environment variables managed by Vault and External Secrets Operator.

For detailed deployment instructions, see `DOCURALIS_DEPLOYMENT.md`.
For Vault setup, see `infra/apps/docuralis/VAULT_SETUP.md`.
