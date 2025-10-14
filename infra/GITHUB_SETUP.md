# GitHub Repository Setup for Argo CD

## Issue

The repository `https://github.com/NicolasHuberty/full-stack-k3s` is currently **private**, and Argo CD cannot access it without credentials.

Error: `authentication required: Repository not found`

---

## Solution 1: Make Repository Public (Recommended)

### Why Public?
- GitOps repositories should not contain secrets
- Easier to manage and share
- No credential management needed
- Industry best practice for infrastructure-as-code

### Steps:
1. Go to: https://github.com/NicolasHuberty/full-stack-k3s/settings
2. Scroll to **Danger Zone**
3. Click **Change visibility**
4. Select **Make public**
5. Type the repository name to confirm
6. Click **I understand, change repository visibility**

### After Making Public:
```bash
# Argo CD will automatically pick up the repository
# Wait 30 seconds, then check:
kubectl get applications -n argocd

# You should see:
# - app-of-apps
# - dev-environment
# - staging-environment
# - production-environment
```

---

## Solution 2: Add GitHub Personal Access Token (Private Repo)

If you must keep the repository private, follow these steps:

### 1. Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. Token name: `argocd-k3s-access`
4. Expiration: Choose your preference (90 days recommended)
5. Select scopes:
   - ✅ `repo` (Full control of private repositories)
6. Click **Generate token**
7. **COPY THE TOKEN** (you won't see it again!)

Example token: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Add Token to Argo CD

```bash
# Delete the old repository secret
kubectl delete secret full-stack-k3s-repo -n argocd

# Create new secret with credentials
kubectl create secret generic full-stack-k3s-repo \
  --from-literal=type=git \
  --from-literal=url=https://github.com/NicolasHuberty/full-stack-k3s.git \
  --from-literal=username=NicolasHuberty \
  --from-literal=password=YOUR_GITHUB_TOKEN_HERE \
  -n argocd

# Label it as a repository secret
kubectl label secret full-stack-k3s-repo \
  argocd.argoproj.io/secret-type=repository \
  -n argocd

# Restart repo-server to pick up changes
kubectl delete pod -n argocd -l app.kubernetes.io/name=argocd-repo-server

# Wait 30 seconds, then check
kubectl get applications -n argocd
```

### 3. Verify Access

```bash
# Check if Argo CD can now access the repository
kubectl exec -n argocd deployment/argocd-repo-server -- \
  sh -c "git ls-remote https://YOUR_TOKEN@github.com/NicolasHuberty/full-stack-k3s.git"

# Check application status
kubectl get application app-of-apps -n argocd -o yaml
```

---

## Next Steps After Repository Access is Fixed

Once Argo CD can access the repository, it will automatically:

1. **Create the three environment applications:**
   - `dev-environment` (namespace: dev)
   - `staging-environment` (namespace: staging)
   - `production-environment` (namespace: production)

2. **Deploy the demo app to each environment:**
   - Dev: 1 replica
   - Staging: 2 replicas
   - Production: 3 replicas (manual sync required)

3. **Verify deployment:**
```bash
# Check all applications
kubectl get applications -n argocd

# Check namespaces
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n production

# Access Argo CD UI
# https://argocd.huberty.pro
# Username: admin
# Password: lA2VmLaHD32iZYbG
```

---

## Troubleshooting

### App Still Shows "Unknown"

```bash
# Force refresh
kubectl patch application app-of-apps -n argocd \
  --type merge \
  -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"normal"}}}'

# Check events
kubectl get events -n argocd --sort-by='.lastTimestamp' | grep app-of-apps
```

### Repository Connection Failed

```bash
# Test from repo-server pod
kubectl exec -n argocd deployment/argocd-repo-server -- \
  git ls-remote https://github.com/NicolasHuberty/full-stack-k3s.git

# Check logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-repo-server --tail=50
```

---

## Security Best Practices

- ✅ Use Personal Access Tokens (PAT), not passwords
- ✅ Set token expiration (90 days max)
- ✅ Store tokens in a password manager
- ✅ Rotate tokens regularly
- ✅ Use minimal scopes (only `repo` for private repos)
- ✅ Never commit tokens to Git
- ✅ Consider using Deploy Keys for read-only access

---

**Choose Option 1 (Public) for simplicity and GitOps best practices!**
