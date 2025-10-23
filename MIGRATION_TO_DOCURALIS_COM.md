# Migration Guide: Switching to Docuralis with docuralis.com Domain

This guide walks you through migrating from the old backend/frontend setup on huberty.pro to the new unified Docuralis application on docuralis.com.

## What Changed

### Domain Changes
| Environment | Old Domain(s) | New Domain |
|-------------|---------------|------------|
| Dev | api-dev.huberty.pro, dev.huberty.pro | dev.docuralis.com |
| Staging | api-staging.huberty.pro, staging.huberty.pro | staging.docuralis.com |
| Production | api.huberty.pro, app.huberty.pro | app.docuralis.com |

### Architecture Changes
- **Before**: Separate Rust/Python backend + Next.js frontend
- **After**: Unified Next.js application (Docuralis)

## Prerequisites

1. **DNS Setup**: Point docuralis.com to your K3s cluster IP (46.202.129.66)
   ```
   A Record: dev.docuralis.com → 46.202.129.66
   A Record: staging.docuralis.com → 46.202.129.66
   A Record: app.docuralis.com → 46.202.129.66
   ```

2. **Cloudflare API Token**: Ensure your Cloudflare API token has access to docuralis.com zone

3. **Access to K3s cluster**: Can run kubectl commands

4. **Access to ArgoCD**: Can sync applications

## Step-by-Step Migration

### Step 1: Update DNS Records

First, ensure your DNS records are pointing to the correct IP:

```bash
# Check current DNS (may take time to propagate)
dig dev.docuralis.com
dig staging.docuralis.com
dig app.docuralis.com

# Expected output: All should point to 46.202.129.66
```

If not set up, add these A records in your DNS provider:
- `dev.docuralis.com` → `46.202.129.66`
- `staging.docuralis.com` → `46.202.129.66`
- `app.docuralis.com` → `46.202.129.66`

### Step 2: Update Cloudflare Token (if needed)

If your ExternalDNS is only configured for huberty.pro, update the Cloudflare API token to include docuralis.com zone:

```bash
# Get current token
kubectl get secret cloudflare-api-token -n external-dns -o jsonpath='{.data.cloudflare_api_token}' | base64 -d

# Update if needed (create a new token with both zones)
kubectl create secret generic cloudflare-api-token \
  --from-literal=cloudflare_api_token=YOUR_NEW_TOKEN \
  --namespace=external-dns \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Step 3: Connect to Your K3s Cluster

```bash
# Set up kubectl context for your K3s cluster
export KUBECONFIG=/path/to/your/kubeconfig.yml

# Or if using kubeconfig in home directory
export KUBECONFIG=~/.kube/config

# Verify connection
kubectl get nodes
kubectl cluster-info
```

### Step 4: Run the Cleanup and Deployment Script

We've provided an automated script to handle the migration:

```bash
cd /Users/nicolas/Documents/k3s-app

# Option 1: Run the complete deployment script
./scripts/deploy-docuralis.sh

# Option 2: Manual step-by-step approach
# First, clean up old deployments
./scripts/cleanup-old-deployments.sh

# Then sync with ArgoCD (see next steps)
```

### Step 5: Push Updated Code to GitHub

All configurations have been updated. Now push to GitHub:

```bash
cd /Users/nicolas/Documents/k3s-app

# Check what changed
git status

# Stage all changes
git add .

# Commit
git commit -m "Migrate to Docuralis with docuralis.com domain

- Update all ingress to use docuralis.com
- Update NEXTAUTH_URL for all environments
- Add docuralis.com to ExternalDNS domain filters
- Remove old backend/frontend deployments"

# Push to dev branch
git checkout dev
git push origin dev

# Push to staging branch
git checkout staging
git merge dev
git push origin staging

# Push to main branch (after testing!)
git checkout main
git merge staging
git push origin main
```

### Step 6: Update ArgoCD Applications

#### Option A: Using ArgoCD CLI

```bash
# Install ArgoCD CLI if needed
brew install argocd  # macOS
# or download from: https://argo-cd.readthedocs.io/en/stable/cli_installation/

# Login to ArgoCD
argocd login argocd.huberty.pro

# Sync External DNS first (to support docuralis.com)
argocd app sync external-dns --force

# Wait for ExternalDNS to restart
kubectl rollout status deployment/external-dns -n external-dns

# Sync Docuralis applications
argocd app sync docuralis-dev --force
argocd app sync docuralis-staging --force
argocd app sync docuralis-production --force

# Monitor sync status
argocd app get docuralis-dev
argocd app get docuralis-staging
argocd app get docuralis-production
```

#### Option B: Using ArgoCD Web UI

1. Go to https://argocd.huberty.pro
2. Login with your credentials
3. Find and sync these apps:
   - `external-dns` → Click "SYNC" → "SYNCHRONIZE"
   - `docuralis-dev` → Click "SYNC" → "SYNCHRONIZE"
   - `docuralis-staging` → Click "SYNC" → "SYNCHRONIZE"
   - `docuralis-production` → Click "SYNC" → "SYNCHRONIZE"

### Step 7: Verify Deployments

Check that new pods are running:

```bash
# Check dev
kubectl get pods -n dev
kubectl logs -n dev -l app=docuralis --tail=50

# Check staging
kubectl get pods -n staging
kubectl logs -n staging -l app=docuralis --tail=50

# Check production
kubectl get pods -n production
kubectl logs -n production -l app=docuralis --tail=50
```

Verify old deployments are gone:

```bash
# Should return "No resources found"
kubectl get deployments -n dev | grep -E "backend|frontend|redis"
kubectl get deployments -n staging | grep -E "backend|frontend|redis"
kubectl get deployments -n production | grep -E "backend|frontend|redis"
```

### Step 8: Verify Ingress and Certificates

Check ingress resources:

```bash
# Dev
kubectl get ingress -n dev
kubectl describe ingress docuralis-ingress -n dev

# Staging
kubectl get ingress -n staging
kubectl describe ingress docuralis-ingress -n staging

# Production
kubectl get ingress -n production
kubectl describe ingress docuralis-ingress -n production
```

Check TLS certificates (may take 2-5 minutes to issue):

```bash
# Dev
kubectl get certificate docuralis-dev-tls -n dev
kubectl describe certificate docuralis-dev-tls -n dev

# Staging
kubectl get certificate docuralis-staging-tls -n staging

# Production
kubectl get certificate docuralis-prod-tls -n production
```

Wait for certificates to show `Ready: True`:

```bash
# Watch certificate status
watch kubectl get certificates --all-namespaces
```

### Step 9: Test Applications

Once certificates are ready, test the applications:

```bash
# Test health endpoints
curl https://dev.docuralis.com/api/health
curl https://staging.docuralis.com/api/health
curl https://app.docuralis.com/api/health

# Expected output: {"status":"ok","timestamp":"..."}
```

Open in browser:
- Dev: https://dev.docuralis.com
- Staging: https://staging.docuralis.com
- Production: https://app.docuralis.com

### Step 10: Run Database Migrations

If this is the first deployment, run Prisma migrations:

```bash
# Dev
kubectl exec -it -n dev deployment/dev-docuralis -- npx prisma migrate deploy

# Staging
kubectl exec -it -n staging deployment/staging-docuralis -- npx prisma migrate deploy

# Production
kubectl exec -it -n production deployment/prod-docuralis -- npx prisma migrate deploy
```

### Step 11: Update OAuth Callback URLs

Don't forget to update OAuth callback URLs with your providers:

#### Google OAuth
1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client
3. Add authorized redirect URIs:
   - `https://dev.docuralis.com/api/auth/callback/google`
   - `https://staging.docuralis.com/api/auth/callback/google`
   - `https://app.docuralis.com/api/auth/callback/google`

#### GitHub OAuth
1. Go to https://github.com/settings/developers
2. Edit your OAuth App
3. Update Authorization callback URL:
   - `https://dev.docuralis.com/api/auth/callback/github`
   - `https://staging.docuralis.com/api/auth/callback/github`
   - `https://app.docuralis.com/api/auth/callback/github`

#### Azure AD
1. Go to https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
2. Edit your app registration
3. Update Redirect URIs:
   - `https://dev.docuralis.com/api/auth/callback/azure-ad`
   - `https://staging.docuralis.com/api/auth/callback/azure-ad`
   - `https://app.docuralis.com/api/auth/callback/azure-ad`

## Troubleshooting

### Issue: DNS not resolving

```bash
# Check DNS propagation
dig dev.docuralis.com
dig staging.docuralis.com
dig app.docuralis.com

# Check ExternalDNS logs
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns --tail=100

# Force ExternalDNS sync
kubectl delete pod -n external-dns -l app.kubernetes.io/name=external-dns
```

### Issue: Certificate not issuing

```bash
# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=100

# Check certificate request
kubectl get certificaterequest -n dev
kubectl describe certificaterequest -n dev

# Delete and recreate certificate
kubectl delete certificate docuralis-dev-tls -n dev
# ArgoCD will recreate it
```

### Issue: Pods not starting

```bash
# Check pod status
kubectl describe pod -n dev -l app=docuralis

# Check logs
kubectl logs -n dev -l app=docuralis --tail=100

# Common issues:
# 1. Image pull errors → Check ghcr-credentials secret
# 2. Secret not found → Check ExternalSecrets are synced
# 3. Database connection → Check DATABASE_URL in secrets
```

### Issue: Old deployments still running

```bash
# Manually delete old deployments
kubectl delete deployment dev-backend dev-frontend dev-redis -n dev
kubectl delete deployment staging-backend staging-frontend -n staging
kubectl delete deployment prod-backend prod-frontend -n production

# Delete old services
kubectl delete service dev-backend dev-frontend dev-redis -n dev
kubectl delete service staging-backend staging-frontend -n staging
kubectl delete service prod-backend prod-frontend -n production

# Delete old ingresses
kubectl delete ingress rag-backend rag-frontend -n dev
kubectl delete ingress rag-backend rag-frontend -n staging
kubectl delete ingress rag-backend rag-frontend -n production
```

## Rollback Plan

If you need to rollback to the old setup:

### Rollback via Git

```bash
# Find the commit before migration
git log --oneline

# Revert to previous commit
git checkout <commit-hash>

# Push to force rollback
git push origin dev --force
git push origin staging --force
git push origin main --force

# Sync ArgoCD
argocd app sync docuralis-dev --force
```

### Manual Rollback

1. Restore old manifests from git history
2. Redeploy via ArgoCD
3. Update DNS back to old setup

## Verification Checklist

After migration, verify:

- [ ] DNS records pointing to 46.202.129.66
- [ ] TLS certificates issued and valid
- [ ] All pods running (dev, staging, production)
- [ ] Health endpoints responding
- [ ] Applications accessible in browser
- [ ] OAuth login working
- [ ] Database connections working
- [ ] File uploads working (MinIO)
- [ ] Chat functionality working (Qdrant)
- [ ] Old deployments removed
- [ ] ArgoCD showing healthy status
- [ ] OAuth callback URLs updated

## Monitoring

Monitor your deployments:

```bash
# Watch pods
kubectl get pods -n dev -w

# Watch deployments
kubectl get deployments --all-namespaces -l app=docuralis

# View logs
kubectl logs -n dev -l app=docuralis -f --tail=100

# Check ArgoCD
argocd app list
argocd app get docuralis-dev
```

Dashboard URLs:
- ArgoCD: https://argocd.huberty.pro
- Grafana: https://grafana.huberty.pro
- Vault: https://vault.huberty.pro

## Post-Migration

After successful migration:

1. Monitor applications for 24-48 hours
2. Update documentation with new URLs
3. Notify team members of new domains
4. Update bookmarks and saved links
5. Consider decommissioning old huberty.pro subdomains (after confirming everything works)

## Support

If you encounter issues:
1. Check logs: `kubectl logs -n <namespace> -l app=docuralis`
2. Check ArgoCD: https://argocd.huberty.pro
3. Check this troubleshooting section
4. Refer to `QUICK_REFERENCE.md` for common commands

---

**Migration completed successfully when all verification items are checked!**
