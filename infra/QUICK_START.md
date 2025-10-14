# Quick Start - Full-Stack Application

## 🚀 What's Been Created

Your GitOps infrastructure now includes a **complete full-stack application**:

### Backend (Rust + Actix-web)
- ✅ RESTful API with OpenAPI documentation
- ✅ Health checks and user management endpoints
- ✅ Multi-stage Docker builds
- ✅ Automatic CI/CD pipeline

### Frontend (Next.js + shadcn/ui)
- ✅ Modern React application with App Router
- ✅ Beautiful UI components from shadcn/ui
- ✅ Tailwind CSS styling
- ✅ Automatic CI/CD pipeline

### Infrastructure
- ✅ Multi-environment setup (dev, staging, production)
- ✅ Separate ingress for frontend and backend
- ✅ Automatic TLS certificates
- ✅ DNS automation

---

## 📍 Environment URLs

Once deployed, your applications will be accessible at:

### Development
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | https://dev.huberty.pro | Web application |
| Backend | https://api-dev.huberty.pro | API endpoints |
| API Docs | https://api-dev.huberty.pro/docs | Interactive API documentation |

### Staging
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | https://staging.huberty.pro | Web application |
| Backend | https://api-staging.huberty.pro | API endpoints |
| API Docs | https://api-staging.huberty.pro/docs | Interactive API documentation |

### Production
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | https://app.huberty.pro | Web application |
| Backend | https://api.huberty.pro | API endpoints |
| API Docs | https://api.huberty.pro/docs | Interactive API documentation |

---

## ⚠️ CRITICAL: Make Repository Public

**The repository is currently PRIVATE and Argo CD cannot access it.**

### Option 1: Make Repository Public (Recommended - 2 minutes)

1. Go to: https://github.com/NicolasHuberty/full-stack-k3s/settings
2. Scroll to **"Danger Zone"**
3. Click **"Change visibility"** → **"Make public"**
4. Type the repository name to confirm
5. Click **"I understand, change repository visibility"**

**Why make it public?**
- GitOps repositories should NOT contain secrets (use Vault for that)
- Easier to manage and share
- No credential management needed
- Industry best practice

### Option 2: Add GitHub Token (if private needed)

See `GITHUB_SETUP.md` for detailed instructions on adding a Personal Access Token to Argo CD.

---

## 📦 After Making Repository Public

Within **30-60 seconds**, Argo CD will:

1. ✅ Detect the repository
2. ✅ Create applications for dev, staging, and production
3. ✅ Deploy backend and frontend to dev namespace
4. ✅ Deploy backend and frontend to staging namespace
5. ⏸️  Wait for manual sync for production

### Verify Deployment

```bash
# Check Argo CD applications
kubectl get applications -n argocd

# You should see:
# - app-of-apps
# - dev-environment
# - staging-environment
# - production-environment

# Check pods in each environment
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n production
```

---

## 🔨 Building Docker Images

Before the applications can run, Docker images need to be built and pushed.

### Make GitHub Packages Public

1. Go to https://github.com/NicolasHuberty?tab=packages
2. You'll see two packages after first build:
   - `k3s-backend`
   - `k3s-frontend`
3. Click each package → **Package settings** → **Change visibility to Public**

### Trigger First Build

The images will be built automatically when you:

#### Option A: Push to any branch (triggers build)
```bash
cd /Users/nicolas/Documents/k3s-app/infra

# Make a small change
echo "# Full-Stack K3s" > README-APP.md
git add README-APP.md
git commit -m "Trigger first build"
git push origin main
```

#### Option B: Manually run workflows

1. Go to: https://github.com/NicolasHuberty/full-stack-k3s/actions
2. Select **"Backend CI/CD"**
3. Click **"Run workflow"** → Select **"main"** branch → **"Run workflow"**
4. Repeat for **"Frontend CI/CD"**

---

## ⏱️ First Deployment Timeline

1. **Immediately**: Repository made public
2. **+30 seconds**: Argo CD detects repository
3. **+1 minute**: Applications created in Argo CD
4. **+5 minutes**: First GitHub Actions build completes
5. **+6 minutes**: Docker images available in GHCR
6. **+7 minutes**: Argo CD syncs and deploys to dev & staging
7. **+10 minutes**: All services running with TLS certificates

---

## 🎯 Quick Test Commands

Once deployed, test your applications:

```bash
# Test backend health (dev)
curl https://api-dev.huberty.pro/api/health

# Test backend users endpoint
curl https://api-dev.huberty.pro/api/users

# View API documentation
open https://api-dev.huberty.pro/docs

# Access frontend
open https://dev.huberty.pro
```

---

## 📊 Monitor Deployment Progress

### Via Argo CD UI

1. Open: https://argocd.huberty.pro
2. Login: `admin` / `lA2VmLaHD32iZYbG`
3. You'll see all environments and their sync status

### Via CLI

```bash
# Watch applications
watch kubectl get applications -n argocd

# Watch pods in dev
watch kubectl get pods -n dev

# Check Argo CD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller --tail=50 -f
```

### Via GitHub Actions

Go to: https://github.com/NicolasHuberty/full-stack-k3s/actions

You'll see the CI/CD pipelines running for both backend and frontend.

---

## 🐛 If Something Goes Wrong

### Repository Still Showing "Unknown" in Argo CD

```bash
# Restart Argo CD repo server
kubectl delete pod -n argocd -l app.kubernetes.io/name=argocd-repo-server

# Wait 30 seconds, then check again
sleep 30
kubectl get applications -n argocd
```

### Images Not Building

1. Check GitHub Actions: https://github.com/NicolasHuberty/full-stack-k3s/actions
2. Look for failed workflows
3. Click on the failed workflow to see logs
4. Common issues:
   - Syntax errors in code
   - Missing dependencies
   - Docker build context issues

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n dev

# Check logs if pod is failing
kubectl logs -n dev <pod-name>

# Common issues:
# - Image pull errors: Make GitHub packages public
# - CrashLoopBackOff: Check application logs
# - Pending: Check resource availability
```

### TLS Certificates Not Issued

```bash
# Check certificate status
kubectl get certificates -A

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=50

# Wait up to 5 minutes for Let's Encrypt validation
```

---

## 📚 Next Steps

1. **Make repository public** (critical!)
2. **Wait for first build** (5-10 minutes)
3. **Verify deployments** in Argo CD
4. **Test applications** at the URLs above
5. **Read FULLSTACK_GUIDE.md** for development workflow
6. **Start building features!** 🎉

---

## 💡 Pro Tips

1. **Dev environment** deploys on every push to `develop` branch
2. **Staging environment** deploys on every push to `main` branch
3. **Production environment** requires manual sync in Argo CD
4. **API docs** are automatically generated from Rust code
5. **Frontend** automatically connects to backend via environment variables

---

## 🎉 Your Stack

```
┌─────────────────────────────────────────┐
│  Full-Stack K3s GitOps Application      │
├─────────────────────────────────────────┤
│  Frontend: Next.js 14 + shadcn/ui       │
│  Backend:  Rust + Actix-web + OpenAPI   │
│  Infra:    K3s + Argo CD + Kustomize    │
│  CI/CD:    GitHub Actions               │
│  TLS:      Let's Encrypt (auto-renewed) │
│  DNS:      ExternalDNS + Cloudflare     │
│  Secrets:  HashiCorp Vault              │
│  Monitor:  Prometheus + Grafana         │
└─────────────────────────────────────────┘
```

**You now have a production-ready, full-stack GitOps platform!** 🚀

---

**Questions?** Check:
- `FULLSTACK_GUIDE.md` - Complete development guide
- `GITHUB_SETUP.md` - Repository access setup
- `TROUBLESHOOTING.md` - Common issues and fixes
- `ENVIRONMENTS.md` - Multi-environment details
