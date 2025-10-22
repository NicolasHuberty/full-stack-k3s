# Immediate Action Items for Docuralis Deployment

## Quick Start: What You Need to Do Now

### 1. Set Up DNS for docuralis.com (5 minutes)

**Action**: Add these A records to your docuralis.com DNS zone:

```
dev.docuralis.com      → 46.202.129.66
staging.docuralis.com  → 46.202.129.66
app.docuralis.com      → 46.202.129.66
```

**How**: See detailed instructions in `DNS_SETUP_INSTRUCTIONS.md`

**Verify**:
```bash
dig dev.docuralis.com  # Should return 46.202.129.66
```

---

### 2. Push Updated Code to GitHub (2 minutes)

All configurations have been updated. Now commit and push:

```bash
cd /Users/nicolas/Documents/k3s-app

# Check changes
git status

# Stage all changes
git add .

# Commit
git commit -m "Migrate to unified Docuralis with docuralis.com domain"

# Push to dev branch first
git push origin dev

# After testing dev, push to staging and main
git checkout staging && git merge dev && git push origin staging
git checkout main && git merge staging && git push origin main
```

---

### 3. Clean Up Old Deployments (5 minutes)

**Action**: Connect to your K3s cluster and run the cleanup script:

```bash
# Connect to your K3s cluster
export KUBECONFIG=/path/to/your/kubeconfig

# Verify connection
kubectl get nodes

# Run cleanup script
cd /Users/nicolas/Documents/k3s-app
./scripts/cleanup-old-deployments.sh
```

This will remove:
- Old backend deployments
- Old frontend deployments
- Old Redis deployments
- Old ingress configurations

---

### 4. Deploy Docuralis via ArgoCD (10 minutes)

**Option A - Automated Script**:
```bash
./scripts/deploy-docuralis.sh
```

**Option B - Manual via ArgoCD UI**:
1. Go to https://argocd.huberty.pro
2. Sync these applications in order:
   - `external-dns` (to support docuralis.com)
   - `docuralis-dev`
   - `docuralis-staging`
   - `docuralis-production`

**Option C - Manual via ArgoCD CLI**:
```bash
argocd login argocd.huberty.pro
argocd app sync external-dns --force
argocd app sync docuralis-dev --force
argocd app sync docuralis-staging --force
argocd app sync docuralis-production --force
```

---

### 5. Verify Deployment (5 minutes)

Check that everything is running:

```bash
# Check pods
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n production

# Check ingress
kubectl get ingress -n dev
kubectl get ingress -n staging
kubectl get ingress -n production

# Wait for certificates (2-5 minutes)
kubectl get certificates --all-namespaces

# Test health endpoints (once DNS propagates)
curl https://dev.docuralis.com/api/health
curl https://staging.docuralis.com/api/health
curl https://app.docuralis.com/api/health
```

---

### 6. Update OAuth Callback URLs (5 minutes per provider)

Update your OAuth applications with new callback URLs:

**Google**: https://console.cloud.google.com/apis/credentials
- Add: `https://dev.docuralis.com/api/auth/callback/google`
- Add: `https://staging.docuralis.com/api/auth/callback/google`
- Add: `https://app.docuralis.com/api/auth/callback/google`

**GitHub**: https://github.com/settings/developers
- Add: `https://dev.docuralis.com/api/auth/callback/github`
- Add: `https://staging.docuralis.com/api/auth/callback/github`
- Add: `https://app.docuralis.com/api/auth/callback/github`

**Azure AD**: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
- Add: `https://dev.docuralis.com/api/auth/callback/azure-ad`
- Add: `https://staging.docuralis.com/api/auth/callback/azure-ad`
- Add: `https://app.docuralis.com/api/auth/callback/azure-ad`

---

## Summary of Changes Made

✅ **Created/Updated Files**:
- GitHub Actions CI/CD workflow for Docuralis
- Kubernetes manifests (base + environment configs)
- Ingress configurations for docuralis.com
- ExternalDNS updated to include docuralis.com
- Deployment patches with correct NEXTAUTH_URL
- Cleanup and deployment automation scripts
- Comprehensive documentation

✅ **Removed**:
- Old backend/frontend base manifests
- Old environment-specific backend/frontend configs
- Old ingress files pointing to huberty.pro

✅ **Domain Changes**:
- Dev: `dev.huberty.pro` → `dev.docuralis.com`
- Staging: `staging.huberty.pro` → `staging.docuralis.com`
- Production: `app.huberty.pro` → `app.docuralis.com`

---

## Expected Timeline

| Step | Time | Status |
|------|------|--------|
| DNS Setup | 5 min + 5 min propagation | ⏳ Pending |
| Push to GitHub | 2 min | ⏳ Pending |
| Cleanup Old Deployments | 5 min | ⏳ Pending |
| Deploy via ArgoCD | 10 min | ⏳ Pending |
| Certificate Issuance | 2-5 min (automatic) | ⏳ Pending |
| Verify & Test | 5 min | ⏳ Pending |
| Update OAuth URLs | 15 min total | ⏳ Pending |
| **Total** | **~45 minutes** | |

---

## Troubleshooting Quick Links

If something goes wrong:

1. **DNS Issues**: See `DNS_SETUP_INSTRUCTIONS.md`
2. **Deployment Issues**: See `MIGRATION_TO_DOCURALIS_COM.md` → Troubleshooting
3. **Common Commands**: See `QUICK_REFERENCE.md`
4. **Complete Guide**: See `DOCURALIS_DEPLOYMENT.md`

---

## Support Resources

- **ArgoCD UI**: https://argocd.huberty.pro
- **Grafana**: https://grafana.huberty.pro
- **Vault**: https://vault.huberty.pro

**Get pod logs**:
```bash
kubectl logs -n dev -l app=docuralis -f --tail=100
```

**Check ArgoCD sync status**:
```bash
argocd app get docuralis-dev
```

---

## Success Criteria

You'll know the migration is successful when:

- ✅ All pods are running in dev/staging/production
- ✅ Ingress resources are created
- ✅ TLS certificates show "Ready: True"
- ✅ DNS resolves to 46.202.129.66
- ✅ Health endpoints return 200 OK
- ✅ Applications load in browser
- ✅ OAuth login works
- ✅ No old backend/frontend pods running

---

## After Deployment

1. ✅ Run database migrations (if needed)
2. ✅ Test all functionality thoroughly in dev
3. ✅ Deploy to staging and test
4. ✅ Deploy to production
5. ✅ Monitor for 24-48 hours
6. ✅ Update team documentation with new URLs

---

**Start with Step 1 (DNS Setup) and work through each step sequentially!**
