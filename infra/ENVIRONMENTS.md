# Multi-Environment Setup

This repository uses a GitOps approach with Argo CD to manage multiple environments.

## Environments

### 🧪 Development (dev)
- **Namespace**: `dev`
- **Replicas**: 1
- **Auto-sync**: ✅ Enabled
- **Self-heal**: ✅ Enabled
- **Log Level**: debug
- **Purpose**: Development and testing

### 🔬 Staging (staging)
- **Namespace**: `staging`
- **Replicas**: 2
- **Auto-sync**: ✅ Enabled
- **Self-heal**: ✅ Enabled
- **Log Level**: info
- **Purpose**: Pre-production testing, QA

### 🚀 Production (production)
- **Namespace**: `production`
- **Replicas**: 3
- **Auto-sync**: ⚠️  Manual (requires approval)
- **Self-heal**: ✅ Enabled
- **Log Level**: warn
- **Purpose**: Production workloads

---

## Directory Structure

```
.
├── argocd/
│   ├── app-of-apps.yaml           # Main App-of-Apps
│   └── environments/
│       ├── dev-app.yaml           # Dev environment app
│       ├── staging-app.yaml       # Staging environment app
│       └── production-app.yaml    # Production environment app
├── base/
│   ├── deployment.yaml            # Base deployment
│   ├── service.yaml               # Base service
│   ├── configmap.yaml             # Base config
│   └── kustomization.yaml         # Base kustomization
├── environments/
│   ├── dev/
│   │   └── kustomization.yaml     # Dev overlay
│   ├── staging/
│   │   └── kustomization.yaml     # Staging overlay
│   └── production/
│       └── kustomization.yaml     # Production overlay
└── .github/
    └── workflows/
        ├── ci.yaml                # CI pipeline
        ├── deploy-dev.yaml        # Dev deployment
        ├── deploy-staging.yaml    # Staging deployment
        └── deploy-production.yaml # Production deployment
```

---

## How It Works

### 1. GitOps Flow

```
Developer Push → GitHub → Argo CD → Kubernetes Cluster
                    ↓
              CI/CD Validation
```

### 2. Deployment Process

#### Development
1. Push to `develop` or `main` branch
2. GitHub Actions runs CI checks
3. Argo CD automatically syncs to `dev` namespace
4. Changes are live immediately

#### Staging
1. Push to `main` branch
2. GitHub Actions runs integration tests
3. Argo CD automatically syncs to `staging` namespace
4. QA team validates

#### Production
1. Create manual workflow dispatch in GitHub
2. Validation and security scans run
3. Manual approval required
4. Argo CD manual sync required (safety measure)
5. GitHub release created

### 3. Kustomize Overlays

Each environment uses Kustomize to patch the base configuration:

- **Dev**: 1 replica, debug logs, `dev-` prefix
- **Staging**: 2 replicas, info logs, `staging-` prefix
- **Production**: 3 replicas, warn logs, `prod-` prefix

---

## Usage

### Deploy App-of-Apps

```bash
# Deploy the main App-of-Apps
kubectl apply -f argocd/app-of-apps.yaml

# This will automatically create:
# - dev-environment
# - staging-environment
# - production-environment
```

### Manual Sync (Production)

```bash
# Via CLI
argocd app sync production-environment

# Via UI
# Go to Argo CD UI → production-environment → SYNC
```

### Check Status

```bash
# All environments
argocd app list

# Specific environment
argocd app get dev-environment
argocd app get staging-environment
argocd app get production-environment

# Via kubectl
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n production
```

### View Logs

```bash
# Dev environment
kubectl logs -n dev -l app=demo-app --tail=50 -f

# Staging environment
kubectl logs -n staging -l app=demo-app --tail=50 -f

# Production environment
kubectl logs -n production -l app=demo-app --tail=50 -f
```

---

## Making Changes

### 1. Update Application Code

```bash
# Edit base configuration
vim base/deployment.yaml

# Commit and push
git add base/
git commit -m "Update application version"
git push origin main
```

### 2. Environment-Specific Changes

```bash
# Edit dev overlay
vim environments/dev/kustomization.yaml

# Test locally
kustomize build environments/dev

# Commit and push
git add environments/dev/
git commit -m "Update dev configuration"
git push origin develop
```

### 3. Production Deployment

```bash
# Via GitHub UI
# Go to Actions → Deploy to Production → Run workflow
# Fill in:
#   - Version: v1.2.3
#   - Reason: New feature release

# Then manually sync in Argo CD
argocd app sync production-environment
```

---

## Monitoring

### Argo CD UI
- **Dev**: https://argocd.huberty.pro (filter: dev-environment)
- **Staging**: https://argocd.huberty.pro (filter: staging-environment)
- **Production**: https://argocd.huberty.pro (filter: production-environment)

### Grafana Dashboards
- **URL**: https://grafana.huberty.pro
- **Dashboards**: Kubernetes per namespace

---

## Rollback

### Via Argo CD

```bash
# List history
argocd app history production-environment

# Rollback to previous version
argocd app rollback production-environment <revision-number>
```

### Via Git

```bash
# Revert commit
git revert <commit-hash>
git push origin main

# Argo CD will automatically sync the rollback
```

---

## Best Practices

1. **Never commit directly to production overlay** - Always test in dev/staging first
2. **Use pull requests** - Review all changes before merging
3. **Tag releases** - Use semantic versioning (v1.2.3)
4. **Test in dev first** - Push to develop branch for dev deployment
5. **Validate in staging** - Ensure staging is green before production
6. **Manual production sync** - Always manually trigger production deployments
7. **Monitor after deployment** - Check Grafana dashboards post-deployment
8. **Document changes** - Update CHANGELOG.md for significant changes

---

## Troubleshooting

### App Not Syncing

```bash
# Check app status
argocd app get <app-name>

# Force refresh
argocd app get <app-name> --refresh

# Check sync status
argocd app sync <app-name> --dry-run
```

### Resource Issues

```bash
# Check events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Check pod status
kubectl describe pod -n <namespace> <pod-name>

# Check logs
kubectl logs -n <namespace> <pod-name> --previous
```

### Kustomize Build Errors

```bash
# Test build locally
kustomize build environments/dev
kustomize build environments/staging
kustomize build environments/production

# Validate YAML
yamllint environments/
```

---

## CI/CD Pipeline Status

[![CI - Lint and Validate](https://github.com/NicolasHuberty/full-stack-k3s/actions/workflows/ci.yaml/badge.svg)](https://github.com/NicolasHuberty/full-stack-k3s/actions/workflows/ci.yaml)

---

**Last Updated**: October 13, 2025
