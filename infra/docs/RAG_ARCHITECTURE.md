# RAG Application Architecture

## Overview

This document describes the architecture for a multi-tenant RAG (Retrieval-Augmented Generation) application with user authentication, file storage, and vector database integration, all managed through HashiCorp Vault.

## System Components

### 1. Infrastructure Services

#### PostgreSQL with pgvector
- **Purpose**: User data, metadata, and vector embeddings storage
- **Image**: `pgvector/pgvector:pg16`
- **Namespace**: `database`
- **Features**:
  - Multi-tenant data isolation via schemas
  - User authentication and authorization
  - File metadata storage
  - Vector embeddings for semantic search
  - Managed by Vault for credentials

#### MinIO (S3-compatible storage)
- **Purpose**: Object storage for uploaded files
- **Image**: `minio/minio:latest`
- **Namespace**: `storage`
- **Features**:
  - Per-user bucket isolation
  - Presigned URL generation
  - Versioning support
  - Direct file upload/download
  - Managed by Vault for access keys

#### Qdrant (Vector Database)
- **Purpose**: High-performance vector similarity search
- **Image**: `qdrant/qdrant:latest`
- **Namespace**: `database`
- **Features**:
  - Per-user collection isolation
  - Fast semantic search
  - Metadata filtering
  - RESTful and gRPC APIs

#### HashiCorp Vault
- **Purpose**: Centralized secrets management and authentication
- **Existing**: Already deployed in cluster
- **Features**:
  - Dynamic database credentials
  - S3 access key generation
  - JWT token validation
  - Per-user secret isolation
  - Audit logging

### 2. Backend API (Rust + Actix-web)

#### Authentication Flow
```
1. User registers → Password hashed → Stored in PostgreSQL
2. User logs in → JWT token issued (signed by Vault)
3. JWT contains: user_id, tenant_id, permissions
4. All API requests validate JWT via Vault
```

#### Endpoints

**Authentication**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT)
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/me` - Get current user info

**File Management**
- `POST /api/files/upload` - Upload file to MinIO
- `GET /api/files` - List user's files
- `GET /api/files/{id}` - Get file metadata
- `DELETE /api/files/{id}` - Delete file
- `GET /api/files/{id}/download` - Download file (presigned URL)

**Vector Search**
- `POST /api/search` - Semantic search across user's documents
- `POST /api/embed` - Generate embeddings for text
- `GET /api/collections` - List user's vector collections

**RAG Operations**
- `POST /api/rag/query` - Query with context retrieval
- `POST /api/rag/chat` - Chat with document context
- `GET /api/rag/history` - Get chat history

#### Multi-Tenancy Implementation

```rust
// Each user gets isolated resources
struct UserResources {
    postgres_schema: String,      // e.g., "user_abc123"
    minio_bucket: String,          // e.g., "user-abc123-files"
    qdrant_collection: String,     // e.g., "user_abc123_vectors"
    vault_path: String,            // e.g., "secret/users/abc123"
}

// Credentials fetched from Vault on-demand
async fn get_user_db_creds(user_id: &str, vault: &VaultClient) -> DbCredentials {
    vault.read_dynamic_db_creds(user_id).await
}

async fn get_user_s3_creds(user_id: &str, vault: &VaultClient) -> S3Credentials {
    vault.read_dynamic_s3_creds(user_id).await
}
```

### 3. Frontend (Next.js + shadcn/ui)

#### Pages
- `/` - Landing page
- `/login` - Login form
- `/register` - Registration form
- `/dashboard` - User dashboard
- `/files` - File management
- `/chat` - RAG chat interface
- `/search` - Semantic search

#### Key Components (shadcn/ui)
- `LoginForm` - Authentication form
- `FileUpload` - Drag-and-drop file upload
- `FileList` - Display user files with actions
- `ChatInterface` - RAG chat with streaming responses
- `SearchBar` - Semantic search input
- `ResultsView` - Search results with relevance scores

## Vault Integration Strategy

### 1. Dynamic Database Credentials

```hcl
# Vault configuration for PostgreSQL
path "database/creds/rag-app-role" {
  capabilities = ["read"]
}

# Each user gets short-lived DB credentials
vault read database/creds/rag-app-role
# Returns: username=v-token-abc123, password=xyz789, ttl=1h
```

### 2. Per-User Secrets

```hcl
# User-specific secrets path
secret/users/{user_id}/
  ├── minio_access_key
  ├── minio_secret_key
  ├── qdrant_api_key
  └── encryption_key
```

### 3. JWT Token Validation

```rust
// Backend validates JWT using Vault's transit engine
async fn validate_token(token: &str, vault: &VaultClient) -> Result<Claims> {
    vault.transit_verify("jwt-key", token).await
}
```

### 4. Secret Rotation

```yaml
# Automatic credential rotation
apiVersion: batch/v1
kind: CronJob
metadata:
  name: rotate-secrets
spec:
  schedule: "0 0 * * 0"  # Weekly
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: rotate
            image: vault:latest
            command:
            - vault
            - rotate
            - root
```

## Data Flow

### File Upload Flow
```
1. User uploads file via frontend
2. Backend validates JWT with Vault
3. Backend gets user's MinIO credentials from Vault
4. File uploaded to user's MinIO bucket (user-{id}-files)
5. File metadata stored in PostgreSQL (user's schema)
6. File chunked and embedded
7. Embeddings stored in Qdrant (user's collection)
8. Success response returned
```

### RAG Query Flow
```
1. User submits query via chat interface
2. Backend validates JWT
3. Query embedded using embedding model
4. Vector search in Qdrant (user's collection only)
5. Top-k relevant chunks retrieved
6. Chunks + query sent to LLM
7. LLM generates contextualized response
8. Response streamed to frontend
9. Query/response saved to PostgreSQL
```

## Security Model

### Authentication Layers
1. **JWT Validation**: All API requests require valid JWT
2. **Vault Integration**: Credentials fetched per-request from Vault
3. **Resource Isolation**: Users can only access their own resources
4. **TLS**: All connections encrypted (Let's Encrypt)
5. **Network Policies**: Restrict inter-service communication

### Data Isolation
- **PostgreSQL**: Each user has a dedicated schema
- **MinIO**: Each user has a dedicated bucket with policies
- **Qdrant**: Each user has a dedicated collection
- **Vault**: Each user has a dedicated secret path

### Audit Trail
- All Vault access logged
- All file operations logged
- All database queries logged
- All RAG queries logged

## Database Schema

```sql
-- User authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File metadata
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    minio_path VARCHAR(500) NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    processing_status VARCHAR(50) DEFAULT 'pending'
);

-- Document chunks with embeddings
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    chunk_text TEXT NOT NULL,
    chunk_index INT NOT NULL,
    embedding vector(1536),  -- OpenAI ada-002 dimension
    qdrant_point_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat history
CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    context_chunks JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector index for similarity search
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## Environment Variables

### Backend
```bash
# Server
HOST=0.0.0.0
PORT=8080
RUST_LOG=info

# Database
DATABASE_URL=postgresql://user:pass@postgresql.database:5432/rag_database

# Vault
VAULT_ADDR=http://vault.vault:8200
VAULT_TOKEN=${VAULT_ROOT_TOKEN}  # From Kubernetes secret

# MinIO
MINIO_ENDPOINT=minio.storage:9000
MINIO_USE_SSL=false
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}

# Qdrant
QDRANT_URL=http://qdrant.database:6333

# JWT
JWT_SECRET=${JWT_SECRET}  # From Vault
JWT_EXPIRY=3600  # 1 hour
```

### Frontend
```bash
NEXT_PUBLIC_API_URL=https://api.huberty.pro
NEXT_PUBLIC_WS_URL=wss://api.huberty.pro/ws
```

## Deployment

All services are managed by Argo CD with GitOps:

```
argocd/
├── apps/
│   ├── postgresql.yaml      # Database deployment
│   ├── minio.yaml            # Object storage deployment
│   ├── qdrant.yaml           # Vector DB deployment
│   ├── backend.yaml          # API deployment
│   └── frontend.yaml         # UI deployment
└── app-of-apps.yaml          # Parent application
```

## Monitoring & Observability

- **Prometheus**: Metrics collection
- **Grafana**: Dashboards for all services
- **Loki**: Log aggregation
- **Jaeger** (future): Distributed tracing

## Scaling Strategy

- **PostgreSQL**: Read replicas for heavy read workloads
- **MinIO**: Distributed mode with multiple nodes
- **Qdrant**: Horizontal scaling with sharding
- **Backend**: HPA based on CPU/memory/request count
- **Frontend**: CDN + multiple replicas

## Cost Optimization

- **Storage**: MinIO lifecycle policies (delete old files)
- **Database**: Connection pooling, prepared statements
- **Vector DB**: Periodic compaction and cleanup
- **Compute**: Autoscaling with min/max replicas

## Future Enhancements

1. **Advanced RAG Features**
   - Multi-document synthesis
   - Citation tracking
   - Hybrid search (keyword + semantic)
   - Query understanding and refinement

2. **Collaboration**
   - Shared collections
   - Team workspaces
   - Permission management

3. **Integrations**
   - External LLM APIs (OpenAI, Anthropic)
   - OCR for scanned documents
   - Speech-to-text for audio files

4. **Analytics**
   - Usage dashboards
   - Query analytics
   - Performance metrics

## References

- [PostgreSQL with pgvector](https://github.com/pgvector/pgvector)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [HashiCorp Vault](https://www.vaultproject.io/docs)
- [MinIO Documentation](https://min.io/docs/minio/kubernetes/upstream/)
- [Actix-web Framework](https://actix.rs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
