# ⚠️ CRITICAL SETUP REQUIRED

## 🔴 Repository is Still PRIVATE - Argo CD Cannot Access It

Your repository `https://github.com/NicolasHuberty/full-stack-k3s` is returning 404, which means it's **still private**.

Argo CD **CANNOT** access private repositories without credentials, and that's why you don't see the stack in Argo CD.

---

## ✅ SOLUTION: Make Repository Public (2 minutes)

### Step-by-Step:

1. **Open your browser** and go to:
   ```
   https://github.com/NicolasHuberty/full-stack-k3s/settings
   ```

2. **Scroll down** to the **"Danger Zone"** section (at the bottom)

3. **Click "Change visibility"**

4. **Select "Make public"**

5. **Type the repository name** to confirm: `NicolasHuberty/full-stack-k3s`

6. **Click "I understand, change repository visibility"**

---

## 🎯 Why Make it Public?

**This is the standard practice for GitOps repositories because:**

✅ Infrastructure code should be transparent and auditable
✅ **NO SECRETS** are stored in Git (we use Vault for that)
✅ Easier collaboration and sharing
✅ No credential management needed
✅ Industry best practice (see: Kubernetes, Flux, Argo CD examples)

**What's Safe to Share:**
- ✅ Kubernetes manifests
- ✅ Helm charts
- ✅ Kustomize configurations
- ✅ Application code
- ✅ CI/CD pipelines
- ✅ Documentation

**What's NOT in Git (stored in Vault):**
- ❌ Database passwords
- ❌ API keys
- ❌ TLS private keys
- ❌ Service account tokens
- ❌ Any sensitive data

---

## 🔄 What Happens After Making it Public?

### Within 30 seconds:
- ✅ Argo CD will detect the repository
- ✅ App-of-Apps will sync successfully

### Within 1 minute:
- ✅ Three environment applications created:
  - `dev-environment`
  - `staging-environment`
  - `production-environment`

### Within 2 minutes:
- ✅ Applications will show in Argo CD UI
- ⚠️ Will show "OutOfSync" (waiting for Docker images)

### After First Docker Build (~5 minutes):
- ✅ Backend and frontend images built
- ✅ Services deployed to dev and staging
- ✅ TLS certificates issued
- ✅ DNS records created
- ✅ Full stack running!

---

## 📊 Verify After Making Public

### 1. Check Repository Access

```bash
# Should return 200 (not 404)
curl -s -o /dev/null -w "%{http_code}" https://github.com/NicolasHuberty/full-stack-k3s
```

### 2. Restart Argo CD Repo Server

```bash
# Restart to pick up the public repository
kubectl delete pod -n argocd -l app.kubernetes.io/name=argocd-repo-server

# Wait 30 seconds
sleep 30
```

### 3. Check Argo CD Applications

```bash
# Should now show all applications
kubectl get applications -n argocd

# Expected output:
# NAME                      SYNC STATUS   HEALTH STATUS
# app-of-apps              Synced        Healthy
# dev-environment          OutOfSync     Progressing
# staging-environment      OutOfSync     Progressing
# production-environment   OutOfSync     Healthy
```

### 4. View in Argo CD UI

Open: https://argocd.huberty.pro
- Username: `admin`
- Password: `lA2VmLaHD32iZYbG`

You should see all your applications!

---

## 🚀 Trigger First Build

After making the repository public, trigger the Docker image builds:

### Option A: Push a Change

```bash
cd /Users/nicolas/Documents/k3s-app/infra

# Any change will trigger the build
echo "Repository is now public!" >> README.md
git add README.md
git commit -m "docs: repository is now public"
git push origin main
```

### Option B: Manual Trigger in GitHub Actions

1. Go to: https://github.com/NicolasHuberty/full-stack-k3s/actions
2. Click **"Backend CI/CD"** → **"Run workflow"** → **"main"** → **"Run workflow"**
3. Click **"Frontend CI/CD"** → **"Run workflow"** → **"main"** → **"Run workflow"**

---

## 🎯 Expected Timeline

```
┌─────────────────────────────────────────────────┐
│  T+0:00  Make repository public                 │
│  T+0:30  Argo CD detects repository             │
│  T+1:00  Applications appear in Argo CD         │
│  T+2:00  Trigger Docker builds (manual/push)    │
│  T+5:00  Backend image built (Rust takes time)  │
│  T+7:00  Frontend image built                   │
│  T+8:00  Argo CD syncs dev environment          │
│  T+9:00  Argo CD syncs staging environment      │
│  T+10:00 TLS certificates issued                │
│  T+11:00 ✅ FULL STACK RUNNING!                 │
└─────────────────────────────────────────────────┘
```

---

## 📦 Make GitHub Packages Public Too

After the first build, you'll have Docker images. Make them public:

1. Go to: https://github.com/NicolasHuberty?tab=packages
2. Click on **`k3s-backend`**
3. Click **"Package settings"** (right side)
4. Scroll to **"Danger Zone"**
5. Click **"Change visibility"** → **"Public"**
6. Repeat for **`k3s-frontend`**

---

## 🐛 Still Not Working?

### Check Argo CD Logs

```bash
# Application controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller --tail=100

# Repo server logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-repo-server --tail=100
```

### Force Refresh App-of-Apps

```bash
# Delete and recreate
kubectl delete application app-of-apps -n argocd
kubectl apply -f /Users/nicolas/Documents/k3s-app/infra/argocd/app-of-apps.yaml

# Wait 30 seconds
sleep 30
kubectl get applications -n argocd
```

### Check GitHub Actions Status

Go to: https://github.com/NicolasHuberty/full-stack-k3s/actions

Look for failed workflows and check the logs.

---

## 🆘 Common Issues

### "Repository not found"
- ✅ **Solution**: Make repository public (steps above)

### "Image pull error"
- ✅ **Solution**: Make GitHub packages public (steps above)

### "No applications in Argo CD"
- ✅ **Solution**: Restart repo-server after making repo public

### "Pods CrashLoopBackOff"
- ✅ **Solution**: Check logs with `kubectl logs -n <namespace> <pod-name>`

---

## ✅ Success Criteria

Your setup is complete when:

- [ ] Repository is public (returns HTTP 200)
- [ ] Argo CD shows 4 applications (app-of-apps + 3 environments)
- [ ] Docker images built and pushed to GHCR
- [ ] Pods running in dev namespace
- [ ] Pods running in staging namespace
- [ ] TLS certificates issued (kubectl get certificates -A)
- [ ] Frontend accessible: https://dev.huberty.pro
- [ ] Backend accessible: https://api-dev.huberty.pro/api/health
- [ ] API docs accessible: https://api-dev.huberty.pro/docs

---

## 📚 After Setup is Complete

Read these guides:
- **QUICK_START.md** - Getting started
- **FULLSTACK_GUIDE.md** - Development workflow
- **ENVIRONMENTS.md** - Multi-environment details
- **TROUBLESHOOTING.md** - Common issues

---

## 🎉 Ready?

**Make the repository public now, then run:**

```bash
# Check repository is public
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/NicolasHuberty/full-stack-k3s

# Should output: 200

# Restart Argo CD
kubectl delete pod -n argocd -l app.kubernetes.io/name=argocd-repo-server

# Wait and check
sleep 30
kubectl get applications -n argocd
```

**You should see your full stack! 🚀**
