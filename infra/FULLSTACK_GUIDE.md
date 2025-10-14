# Full-Stack Application Guide

This guide explains how to deploy and manage the full-stack application with Rust backend and Next.js frontend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                             │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │   Cloudflare    │
        │   DNS + Proxy   │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  Traefik        │
        │  (TLS Termination)
        └─────┬───────┬───┘
              │       │
     ┌────────▼──┐ ┌──▼────────┐
     │ Frontend  │ │  Backend  │
     │ Next.js   │ │  Rust API │
     │ (Port 3000)│ │ (Port 8080)│
     └───────────┘ └───────────┘
```

---

## Stack Components

### Backend (Rust)
- **Framework**: Actix-web
- **API Documentation**: OpenAPI/Swagger at `/docs`
- **Features**:
  - RESTful API endpoints
  - Health check at `/api/health`
  - User management at `/api/users`
  - CORS enabled
  - Auto-generated API documentation

### Frontend (Next.js)
- **Framework**: Next.js 14 with App Router
- **UI Library**: shadcn/ui
- **Styling**: Tailwind CSS
- **Features**:
  - Server-side rendering
  - API integration with backend
  - Responsive design
  - Dark mode support

---

## Environments and URLs

### Development
- **Frontend**: https://dev.huberty.pro
- **Backend API**: https://api-dev.huberty.pro
- **API Docs**: https://api-dev.huberty.pro/docs
- **Replicas**: 1 frontend, 1 backend
- **Auto-sync**: ✅ Enabled

### Staging
- **Frontend**: https://staging.huberty.pro
- **Backend API**: https://api-staging.huberty.pro
- **API Docs**: https://api-staging.huberty.pro/docs
- **Replicas**: 2 frontend, 2 backend
- **Auto-sync**: ✅ Enabled

### Production
- **Frontend**: https://app.huberty.pro
- **Backend API**: https://api.huberty.pro
- **API Docs**: https://api.huberty.pro/docs
- **Replicas**: 3 frontend, 3 backend
- **Auto-sync**: ⚠️ Manual (requires approval)

---

## Development Workflow

### 1. Local Development

#### Backend (Rust)

```bash
cd apps/backend

# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Run locally
cargo run

# The API will be available at http://localhost:8080
# API docs at http://localhost:8080/docs

# Run tests
cargo test

# Check formatting
cargo fmt --check

# Run linter
cargo clippy
```

#### Frontend (Next.js)

```bash
cd apps/frontend

# Install dependencies
npm install

# Run development server
npm run dev

# The app will be available at http://localhost:3000

# Build for production
npm run build

# Run linter
npm run lint
```

### 2. Making Changes

```bash
# Create a feature branch
git checkout -b feature/my-new-feature

# Make your changes to backend or frontend
vim apps/backend/src/main.rs
vim apps/frontend/src/app/page.tsx

# Test locally
cd apps/backend && cargo test
cd apps/frontend && npm run build

# Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/my-new-feature
```

### 3. CI/CD Pipeline

When you push code:

1. **Pull Request** (any branch → main):
   - ✅ Runs linters and tests
   - ✅ Builds Docker images (but doesn't push)
   - ✅ Security scans

2. **Push to `develop`** branch:
   - ✅ Runs CI checks
   - ✅ Builds and pushes Docker images
   - ✅ Tags: `develop`, `develop-<sha>`
   - ✅ Argo CD auto-deploys to **dev** environment

3. **Push to `main`** branch:
   - ✅ Runs CI checks
   - ✅ Builds and pushes Docker images
   - ✅ Tags: `main`, `main-<sha>`, `latest`
   - ✅ Argo CD auto-deploys to **staging** environment
   - ⏸️ Production requires manual sync

---

## Deployment Process

### Automatic Deployment (Dev & Staging)

```bash
# Push to develop (deploys to dev)
git checkout develop
git merge feature/my-new-feature
git push origin develop

# GitHub Actions will:
# 1. Build Docker images
# 2. Push to ghcr.io
# 3. Argo CD detects changes
# 4. Auto-deploys to dev namespace

# Check deployment status
kubectl get pods -n dev
argocd app get dev-environment
```

### Manual Deployment (Production)

```bash
# 1. Merge to main (deploys to staging)
git checkout main
git merge develop
git push origin main

# 2. Test in staging
curl https://staging.huberty.pro
curl https://api-staging.huberty.pro/api/health

# 3. Manually sync production in Argo CD
argocd app sync production-environment

# Or via UI: https://argocd.huberty.pro
```

---

## API Documentation

The backend automatically generates OpenAPI documentation accessible at `/docs`.

### Available Endpoints

#### Health Check
```bash
GET /api/health

Response:
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "dev",
  "timestamp": "2025-10-13T18:00:00Z"
}
```

#### List Users
```bash
GET /api/users

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alice",
      "email": "alice@example.com"
    }
  ],
  "message": "Users retrieved successfully"
}
```

#### Get User by ID
```bash
GET /api/users/{id}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Sample User",
    "email": "user1@example.com"
  },
  "message": "User retrieved successfully"
}
```

### Testing the API

```bash
# Development
curl https://api-dev.huberty.pro/api/health

# Staging
curl https://api-staging.huberty.pro/api/health

# Production
curl https://api.huberty.pro/api/health

# View interactive docs
open https://api-dev.huberty.pro/docs
```

---

## Adding New Features

### Backend: Add New API Endpoint

1. **Update `src/main.rs`:**

```rust
// Add new struct
#[derive(Serialize, Deserialize, ToSchema)]
struct Product {
    id: u32,
    name: String,
    price: f64,
}

// Add new endpoint
#[utoipa::path(
    get,
    path = "/api/products",
    tag = "products",
    responses(
        (status = 200, description = "List of products", body = ApiResponse<Vec<Product>>)
    )
)]
async fn get_products() -> impl Responder {
    let products = vec![
        Product { id: 1, name: "Laptop".to_string(), price: 999.99 },
    ];
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(products),
        message: "Products retrieved".to_string(),
    })
}

// Register route in main()
.route("/api/products", web::get().to(get_products))
```

2. **Update OpenAPI schema:**

```rust
#[derive(OpenApi)]
#[openapi(
    paths(
        health,
        get_users,
        get_user,
        get_products  // Add here
    ),
    components(
        schemas(Product)  // Add here
    ),
)]
struct ApiDoc;
```

3. **Test locally, commit, and push:**

```bash
cargo run  # Test locally
git add src/main.rs
git commit -m "Add products endpoint"
git push origin develop
```

### Frontend: Add New Component

1. **Create component:**

```bash
cd apps/frontend/src/components

# Create new component
cat > ProductList.tsx << 'EOF'
"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function ProductList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Products</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Your component logic */}
      </CardContent>
    </Card>
  );
}
EOF
```

2. **Use in page:**

```tsx
// src/app/page.tsx
import { ProductList } from "@/components/ProductList";

export default function Home() {
  return (
    <main>
      <ProductList />
    </main>
  );
}
```

3. **Test, commit, and push:**

```bash
npm run dev  # Test locally
git add .
git commit -m "Add product list component"
git push origin develop
```

---

## Docker Images

Images are automatically built and pushed to GitHub Container Registry:

- Backend: `ghcr.io/nicolashuberty/k3s-backend:latest`
- Frontend: `ghcr.io/nicolashuberty/k3s-frontend:latest`

### Manual Build (if needed)

```bash
# Backend
cd apps/backend
docker build -t k3s-backend:local .
docker run -p 8080:8080 k3s-backend:local

# Frontend
cd apps/frontend
docker build -t k3s-frontend:local .
docker run -p 3000:3000 k3s-frontend:local
```

---

## Monitoring and Debugging

### Check Application Status

```bash
# All environments
kubectl get pods -A | grep -E "(dev|staging|production)"

# Specific environment
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n production

# Check logs
kubectl logs -n dev -l app=backend --tail=50 -f
kubectl logs -n dev -l app=frontend --tail=50 -f
```

### Argo CD Status

```bash
# List all applications
argocd app list

# Get specific app details
argocd app get dev-environment
argocd app get staging-environment
argocd app get production-environment

# View sync history
argocd app history production-environment

# Force refresh
argocd app sync dev-environment --force
```

### Access Services

```bash
# Port-forward for local access (useful for debugging)
kubectl port-forward -n dev svc/dev-backend 8080:8080
kubectl port-forward -n dev svc/dev-frontend 3000:3000

# Then access at:
# Backend: http://localhost:8080
# Frontend: http://localhost:3000
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
kubectl logs -n dev -l app=backend --tail=100

# Common issues:
# - Image pull errors: Check GitHub Container Registry permissions
# - Crash loop: Check Rust panic messages in logs
# - Health check failing: Verify port 8080 is exposed
```

### Frontend Not Loading

```bash
# Check logs
kubectl logs -n dev -l app=frontend --tail=100

# Common issues:
# - API connection failed: Check NEXT_PUBLIC_API_URL env var
# - Build errors: Check build logs in GitHub Actions
# - 404 errors: Verify Next.js build completed successfully
```

### Image Pull Errors

```bash
# Images are public in GHCR, but if you have issues:
# 1. Check if images exist
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://ghcr.io/v2/nicolashuberty/k3s-backend/tags/list

# 2. Make packages public in GitHub
# Go to: https://github.com/NicolasHuberty?tab=packages
# Select package → Settings → Change visibility to Public
```

### Argo CD Sync Issues

```bash
# Check sync status
argocd app get dev-environment

# Common issues:
# - OutOfSync: Changes in Git not yet applied
# - Degraded: Pods failing, check pod logs
# - Progressing: Deployment in progress, wait

# Force sync
argocd app sync dev-environment --force --prune
```

---

## Environment Variables

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Log level | `info` |
| `HOST` | Bind address | `0.0.0.0` |
| `PORT` | Port to listen on | `8080` |
| `ENVIRONMENT` | Environment name | `dev` |
| `VERSION` | App version | `0.1.0` |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Port to listen on | `3000` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://backend:8080` |
| `NEXT_PUBLIC_ENVIRONMENT` | Environment name | `dev` |

---

## Security Best Practices

1. **Never commit secrets** - Use Vault for secrets management
2. **Review pull requests** - All changes should be reviewed
3. **Test in dev/staging first** - Never deploy directly to production
4. **Monitor logs** - Check Grafana dashboards regularly
5. **Keep dependencies updated** - Run `cargo update` and `npm update` regularly
6. **Use HTTPS** - All traffic is encrypted with Let's Encrypt
7. **Scan for vulnerabilities** - GitHub Actions runs Trivy scans

---

## Performance Optimization

### Backend
- Multi-stage Docker builds reduce image size
- Alpine Linux for minimal footprint
- Release builds with LTO enabled
- Resource limits prevent runaway processes

### Frontend
- Next.js standalone output for smaller images
- Static optimization enabled
- Image optimization with Next.js Image component
- Code splitting automatic with App Router

---

## Scaling

### Horizontal Scaling

```bash
# Scale deployments
kubectl scale deployment -n dev dev-backend --replicas=3
kubectl scale deployment -n dev dev-frontend --replicas=3

# Auto-scaling (HPA)
kubectl autoscale deployment -n dev dev-backend \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

### Resource Requests/Limits

Edit `base/backend/deployment.yaml` or `base/frontend/deployment.yaml`:

```yaml
resources:
  requests:
    cpu: 200m      # Increase for better performance
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

---

## Next Steps

1. **Add database** - PostgreSQL with persistent volumes
2. **Add caching** - Redis for session management
3. **Add message queue** - RabbitMQ or Kafka
4. **Add observability** - Loki for logs, Tempo for traces
5. **Add testing** - Integration tests, E2E tests
6. **Add monitoring** - Custom Grafana dashboards
7. **Add authentication** - OAuth2/OIDC with Keycloak

---

**Happy Coding! 🚀**
