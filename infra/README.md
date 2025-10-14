# K3s GitOps Full-Stack RAG Application

Production-ready Kubernetes infrastructure running on K3s with a complete RAG (Retrieval-Augmented Generation) application featuring multi-tenant isolation, Vault-managed secrets, and GitOps deployment via Argo CD.

## 🏗️ Architecture Overview

### Infrastructure Stack

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Kubernetes** | Container orchestration | K3s (lightweight Kubernetes) |
| **GitOps** | Continuous deployment | Argo CD |
| **Ingress** | Load balancing & routing | Traefik |
| **TLS** | Certificate management | cert-manager + Let's Encrypt |
| **DNS** | Automatic DNS records | ExternalDNS + Cloudflare |
| **Secrets** | Secrets management | HashiCorp Vault |
| **Monitoring** | Metrics & dashboards | Prometheus + Grafana |
| **Logging** | Log aggregation | Loki + Promtail |

### Application Stack

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Backend API** | REST API & business logic | Rust + Actix-web |
| **Frontend** | User interface | Next.js 14 + shadcn/ui |
| **Database** | Relational data + vectors | PostgreSQL with pgvector |
| **Vector DB** | Semantic search | Qdrant |
| **Object Storage** | File storage | MinIO (S3-compatible) |
| **Auth** | User authentication | JWT + Vault integration |

## 🚀 Features

### Multi-Tenant RAG System
- ✅ **User Authentication**: JWT-based auth with Vault-managed secrets
- ✅ **File Upload**: Upload documents to isolated MinIO buckets
- ✅ **Semantic Search**: Vector similarity search with Qdrant
- ✅ **Document Chat**: RAG-powered chat with your documents
- ✅ **Complete Isolation**: Per-user PostgreSQL schemas, MinIO buckets, and Qdrant collections

### Infrastructure Features
- ✅ **GitOps**: All infrastructure as code, version-controlled
- ✅ **Auto-Scaling**: HPA for backend and frontend
- ✅ **Multi-Environment**: Dev, Staging, Production with different configs
- ✅ **TLS Everywhere**: Automatic HTTPS certificates
- ✅ **Automated DNS**: Cloudflare records created automatically
- ✅ **Secret Rotation**: Vault-managed dynamic credentials
- ✅ **Observability**: Full monitoring and logging stack

## 📁 Project Structure

```
k3s-app/
├── README.md                          # This file
└── infra/                             # Infrastructure as code
    ├── apps/
    │   ├── backend/                   # Rust backend application
    │   │   ├── src/
    │   │   │   ├── main.rs           # API server entry point
    │   │   │   ├── config.rs         # Configuration management
    │   │   │   ├── models/           # Data models
    │   │   │   ├── handlers/         # HTTP handlers
    │   │   │   ├── services/         # Business logic
    │   │   │   │   ├── vault.rs      # Vault integration
    │   │   │   │   ├── minio.rs      # MinIO integration
    │   │   │   │   └── qdrant.rs     # Qdrant integration
    │   │   │   ├── middleware/       # Auth middleware
    │   │   │   └── db/               # Database layer
    │   │   ├── Cargo.toml            # Rust dependencies
    │   │   └── Dockerfile            # Backend container image
    │   ├── frontend/                  # Next.js frontend application
    │   │   ├── src/
    │   │   │   ├── app/              # Next.js 14 app directory
    │   │   │   ├── components/       # shadcn/ui components
    │   │   │   ├── lib/              # Utilities
    │   │   │   └── hooks/            # React hooks
    │   │   ├── package.json          # Node dependencies
    │   │   └── Dockerfile            # Frontend container image
    │   ├── postgresql/               # PostgreSQL deployment
    │   ├── minio/                    # MinIO deployment
    │   └── qdrant/                   # Qdrant deployment
    ├── base/                          # Kustomize base configs
    │   ├── backend/
    │   ├── frontend/
    │   └── ...
    ├── environments/                  # Environment-specific configs
    │   ├── dev/
    │   ├── staging/
    │   └── production/
    ├── argocd/                        # Argo CD application definitions
    │   ├── app-of-apps.yaml          # Root application
    │   └── environments/             # Per-environment apps
    ├── bootstrap/                     # Initial cluster setup
    │   ├── metallb-config.yaml       # Load balancer
    │   ├── argocd-install.yaml       # Argo CD installation
    │   └── vault-setup.yaml          # Vault configuration
    ├── manifests/                     # Additional K8s resources
    │   ├── issuers/                  # cert-manager issuers
    │   ├── rbac/                     # RBAC policies
    │   └── network-policies/         # Network policies
    ├── docs/                          # Documentation
    │   ├── RAG_ARCHITECTURE.md       # RAG system architecture
    │   └── IMAGE_PULL_SECRETS.md     # Container registry setup
    └── scripts/                       # Utility scripts
        └── create-image-pull-secrets.sh
```

## 🎯 Quick Start

### Prerequisites

- K3s cluster (or any Kubernetes 1.23+)
- `kubectl` configured
- Domain with Cloudflare DNS
- GitHub account for container registry

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/NicolasHuberty/full-stack-k3s.git
cd full-stack-k3s/infra

# Install MetalLB (for LoadBalancer support)
kubectl apply -f bootstrap/metallb-config.yaml

# Install Argo CD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for Argo CD to be ready
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

# Get Argo CD admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### 2. Configure Secrets

```bash
# Create Cloudflare API token secret (for ExternalDNS and cert-manager)
kubectl create secret generic cloudflare-api-token \
  --from-literal=api-token=YOUR_CLOUDFLARE_API_TOKEN \
  -n kube-system

# Create Vault root token secret
kubectl create secret generic vault-root-token \
  --from-literal=token=YOUR_VAULT_TOKEN \
  -n vault
```

### 3. Deploy Infrastructure Services

```bash
# Deploy PostgreSQL
kubectl apply -f apps/postgresql/deployment.yaml

# Deploy MinIO
kubectl apply -f apps/minio/deployment.yaml

# Deploy Qdrant
kubectl apply -f apps/qdrant/deployment.yaml

# Wait for databases to be ready
kubectl wait --for=condition=available --timeout=300s deployment/postgresql -n database
kubectl wait --for=condition=available --timeout=300s deployment/minio -n storage
kubectl wait --for=condition=available --timeout=300s deployment/qdrant -n database
```

### 4. Initialize Vault for RAG Application

```bash
# Enable database secrets engine
kubectl exec -it vault-0 -n vault -- vault secrets enable database

# Configure PostgreSQL dynamic credentials
kubectl exec -it vault-0 -n vault -- vault write database/config/postgresql \
  plugin_name=postgresql-database-plugin \
  allowed_roles="rag-app-role" \
  connection_url="postgresql://{{username}}:{{password}}@postgresql.database:5432/rag_database" \
  username="rag_admin" \
  password="changeme123"

# Create role for dynamic credentials
kubectl exec -it vault-0 -n vault -- vault write database/roles/rag-app-role \
  db_name=postgresql \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
    GRANT ALL PRIVILEGES ON DATABASE rag_database TO \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"
```

### 5. Build and Push Container Images

```bash
# Build backend
cd apps/backend
docker build -t ghcr.io/nicolashuberty/k3s-backend:latest .
docker push ghcr.io/nicolashuberty/k3s-backend:latest

# Build frontend
cd ../frontend
docker build -t ghcr.io/nicolashuberty/k3s-frontend:latest .
docker push ghcr.io/nicolashuberty/k3s-frontend:latest
```

### 6. Deploy via Argo CD

```bash
# Deploy the app-of-apps pattern
kubectl apply -f argocd/app-of-apps.yaml

# Watch deployments
kubectl get applications -n argocd -w

# Check all pods
kubectl get pods -A
```

## 🌐 Access URLs

After deployment, your applications will be available at:

| Service | URL | Description |
|---------|-----|-------------|
| **Dev Frontend** | https://dev.huberty.pro | Development UI |
| **Dev Backend** | https://api-dev.huberty.pro | Development API |
| **Staging Frontend** | https://staging.huberty.pro | Staging UI |
| **Staging Backend** | https://api-staging.huberty.pro | Staging API |
| **Production Frontend** | https://app.huberty.pro | Production UI |
| **Production Backend** | https://api.huberty.pro | Production API |
| **Argo CD** | https://argocd.huberty.pro | GitOps dashboard |
| **Grafana** | https://grafana.huberty.pro | Monitoring |
| **Vault** | https://vault.huberty.pro | Secrets management |
| **MinIO Console** | https://minio.huberty.pro | Object storage UI |

## 🔐 Security & Multi-Tenancy

### Vault Integration

All sensitive credentials are managed by Vault:

```rust
// Backend fetches dynamic credentials per-user
async fn get_user_resources(user_id: &str, vault: &VaultClient) -> UserResources {
    UserResources {
        db_creds: vault.read_dynamic_db_creds(user_id).await?,
        s3_creds: vault.read_dynamic_s3_creds(user_id).await?,
        qdrant_key: vault.read_secret(&format!("users/{}/qdrant", user_id)).await?,
    }
}
```

### Data Isolation

Each user gets completely isolated resources:

- **PostgreSQL Schema**: `user_{user_id}`
- **MinIO Bucket**: `user-{user_id}-files`
- **Qdrant Collection**: `user_{user_id}_vectors`
- **Vault Path**: `secret/users/{user_id}/`

### Authentication Flow

```
1. User registers → Password hashed with Argon2 → Stored in PostgreSQL
2. User logs in → JWT token issued (signed via Vault transit engine)
3. JWT validated on every request → User identity established
4. Per-request credentials fetched from Vault (short-lived)
5. User can only access their own data (enforced at DB/storage layer)
```

## 📊 RAG System

### Architecture

See [docs/RAG_ARCHITECTURE.md](infra/docs/RAG_ARCHITECTURE.md) for complete details.

### Key Features

1. **File Upload**: Users upload documents (PDF, TXT, MD, etc.)
2. **Chunking**: Documents split into semantic chunks
3. **Embedding**: Chunks embedded using OpenAI/local models
4. **Storage**: Embeddings stored in Qdrant + PostgreSQL
5. **Search**: Vector similarity search for relevant chunks
6. **RAG**: Retrieved chunks provide context for LLM responses

### API Endpoints

```bash
# Authentication
POST /api/auth/register    # Register new user
POST /api/auth/login       # Login (get JWT)
GET  /api/auth/me          # Get current user

# File Management
POST /api/files/upload     # Upload document
GET  /api/files            # List user's files
GET  /api/files/{id}       # Get file metadata
DELETE /api/files/{id}     # Delete file

# RAG Operations
POST /api/search           # Semantic search
POST /api/rag/query        # Query with RAG
POST /api/rag/chat         # Chat interface
GET  /api/rag/history      # Chat history
```

## 🛠️ Development

### Local Development

```bash
# Run PostgreSQL locally
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d pgvector/pgvector:pg16

# Run MinIO locally
docker run --name minio -p 9000:9000 -p 9001:9001 -e "MINIO_ROOT_USER=minioadmin" -e "MINIO_ROOT_PASSWORD=minioadmin123" -d minio/minio server /data --console-address ":9001"

# Run Qdrant locally
docker run --name qdrant -p 6333:6333 -p 6334:6334 -d qdrant/qdrant

# Run Vault locally
docker run --name vault --cap-add=IPC_LOCK -e 'VAULT_DEV_ROOT_TOKEN_ID=myroot' -p 8200:8200 -d vault

# Run backend
cd infra/apps/backend
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_database
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=myroot
cargo run

# Run frontend
cd infra/apps/frontend
npm install
npm run dev
```

### Build Docker Images

```bash
# Backend
docker build -t k3s-backend:dev -f infra/apps/backend/Dockerfile infra/apps/backend/

# Frontend
docker build -t k3s-frontend:dev -f infra/apps/frontend/Dockerfile infra/apps/frontend/
```

## 🔄 CI/CD Pipeline

GitHub Actions automatically:

1. **Lints** all YAML files
2. **Builds** Docker images for backend and frontend
3. **Pushes** images to GitHub Container Registry
4. **Triggers** Argo CD sync (via webhook or polling)
5. **Deploys** to dev environment automatically
6. **Requires approval** for staging and production

### Workflow Files

- `.github/workflows/backend.yml` - Backend CI/CD
- `.github/workflows/frontend.yml` - Frontend CI/CD
- `.github/workflows/ci.yml` - Infrastructure linting

## 📈 Monitoring

### Prometheus Metrics

Backend exposes metrics at `/metrics`:

```
# Request metrics
http_requests_total
http_request_duration_seconds

# Database metrics
db_connections_active
db_query_duration_seconds

# MinIO metrics
minio_upload_duration_seconds
minio_download_duration_seconds

# Vector DB metrics
qdrant_search_duration_seconds
qdrant_index_size
```

### Grafana Dashboards

Pre-configured dashboards available at https://grafana.huberty.pro:

- **RAG Application** - Request rates, latencies, errors
- **PostgreSQL** - Connections, queries, replication lag
- **MinIO** - Storage usage, throughput
- **Qdrant** - Search performance, collection size
- **Kubernetes** - Pod metrics, resource usage

## 🐛 Troubleshooting

### Pods in ImagePullBackOff

See [docs/IMAGE_PULL_SECRETS.md](infra/docs/IMAGE_PULL_SECRETS.md)

### Argo CD Application Degraded

```bash
# Check application status
kubectl get applications -n argocd

# Describe application for errors
kubectl describe application dev-environment -n argocd

# Force refresh
kubectl patch application dev-environment -n argocd --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'

# Check Kustomize build locally
kubectl kustomize environments/dev
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
kubectl get pods -n database

# Test connection from backend pod
kubectl exec -it deployment/dev-backend -n dev -- psql $DATABASE_URL -c "SELECT 1"

# Check Vault dynamic credentials
kubectl exec -it vault-0 -n vault -- vault read database/creds/rag-app-role
```

### MinIO Access Issues

```bash
# Check MinIO is running
kubectl get pods -n storage

# Port-forward to MinIO console
kubectl port-forward svc/minio 9001:9001 -n storage

# Access console at http://localhost:9001
# Login: minioadmin / minioadmin123
```

## 📚 Additional Documentation

- [RAG Architecture](infra/docs/RAG_ARCHITECTURE.md) - Detailed RAG system design
- [Image Pull Secrets](infra/docs/IMAGE_PULL_SECRETS.md) - Container registry setup
- [Vault Integration](https://www.vaultproject.io/docs) - HashiCorp Vault docs
- [Argo CD](https://argo-cd.readthedocs.io/) - GitOps documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **K3s** - Lightweight Kubernetes distribution
- **Argo CD** - GitOps continuous delivery
- **HashiCorp Vault** - Secrets management
- **pgvector** - PostgreSQL vector extension
- **Qdrant** - Vector similarity search
- **MinIO** - S3-compatible object storage
- **Actix-web** - Rust web framework
- **Next.js** - React framework
- **shadcn/ui** - UI component library

---

**Built with ❤️ by Nicolas Huberty**

🤖 Infrastructure automated with [Claude Code](https://claude.com/claude-code)
