# Image Pull Secrets for Private Container Registry

## Problem

The applications in Argo CD show as "Degraded" with pods in `ImagePullBackOff` status. This occurs because:

1. The Docker images are stored in **GitHub Container Registry (ghcr.io)**
2. The images are **private** (not publicly accessible)
3. Kubernetes needs authentication credentials to pull private images
4. No image pull secrets are configured in the cluster

## Error Message

```
Failed to pull image "ghcr.io/nicolashuberty/k3s-backend:latest":
failed to authorize: failed to fetch anonymous token:
unexpected status from GET request: 403 Forbidden
```

## Solution 1: Create Image Pull Secrets (Recommended for Production)

This is the proper approach for production environments where you want to keep images private.

### Steps:

#### 1. Create a GitHub Personal Access Token (PAT)

1. Go to: https://github.com/settings/tokens/new
2. Give it a name: `K3s Container Registry Pull`
3. Set expiration (or no expiration for long-term use)
4. Select scopes: **`read:packages`**
5. Click **Generate token**
6. **Copy the token immediately** (you won't be able to see it again)

#### 2. Run the Setup Script

We've created a helper script to automate the secret creation:

```bash
cd /Users/nicolas/Documents/k3s-app/infra
./scripts/create-image-pull-secrets.sh
```

The script will:
- Prompt for your GitHub username (defaults to NicolasHuberty)
- Prompt for your GitHub email
- Prompt for your GitHub PAT
- Create the `ghcr-secret` in dev, staging, and production namespaces
- Verify the secrets are created

#### 3. Manual Creation (Alternative)

If you prefer to create secrets manually:

```bash
# For dev namespace
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=NicolasHuberty \
  --docker-password=YOUR_GITHUB_PAT \
  --docker-email=your-email@example.com \
  -n dev

# For staging namespace
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=NicolasHuberty \
  --docker-password=YOUR_GITHUB_PAT \
  --docker-email=your-email@example.com \
  -n staging

# For production namespace
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=NicolasHuberty \
  --docker-password=YOUR_GITHUB_PAT \
  --docker-email=your-email@example.com \
  -n production
```

#### 4. Verify Secrets

```bash
kubectl get secrets -n dev | grep ghcr-secret
kubectl get secrets -n staging | grep ghcr-secret
kubectl get secrets -n production | grep ghcr-secret
```

#### 5. Trigger Argo CD Sync

```bash
# Argo CD should auto-sync, but you can force it:
argocd app sync dev-environment
argocd app sync staging-environment
argocd app sync production-environment
```

#### 6. Verify Pods are Running

```bash
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n production
```

Pods should transition from `ImagePullBackOff` to `Running` within 1-2 minutes.

## Solution 2: Make Container Images Public (Recommended for Demo/Learning)

If this is a demo or learning project and you don't need private images, you can make them public:

### Steps:

#### 1. Make Backend Package Public

1. Go to: https://github.com/users/NicolasHuberty/packages/container/k3s-backend/settings
2. Scroll to **Danger Zone**
3. Click **Change visibility**
4. Select **Public**
5. Type the package name to confirm
6. Click **I understand, change package visibility**

#### 2. Make Frontend Package Public

1. Go to: https://github.com/users/NicolasHuberty/packages/container/k3s-frontend/settings
2. Follow the same steps as above

#### 3. Verify Public Access

```bash
# Should return 200 OK instead of 401
curl -I https://ghcr.io/v2/nicolashuberty/k3s-backend/manifests/latest
```

#### 4. Restart Deployments

```bash
kubectl rollout restart deployment -n dev
kubectl rollout restart deployment -n staging
kubectl rollout restart deployment -n production
```

Kubernetes will automatically pull the now-public images without authentication.

## How Image Pull Secrets Work

The deployment files have been updated to reference the `ghcr-secret`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      imagePullSecrets:          # <-- References the secret
        - name: ghcr-secret
      containers:
        - name: backend
          image: ghcr.io/nicolashuberty/k3s-backend:latest
```

When Kubernetes tries to pull the image:
1. It checks for `imagePullSecrets` in the pod spec
2. It retrieves the credentials from the `ghcr-secret` secret
3. It uses those credentials to authenticate with ghcr.io
4. It successfully pulls the private image

## Troubleshooting

### Pods Still in ImagePullBackOff

```bash
# Check secret exists
kubectl get secret ghcr-secret -n dev

# Check secret contents (base64 encoded)
kubectl get secret ghcr-secret -n dev -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d | jq

# Check pod events
kubectl describe pod <pod-name> -n dev

# Check if PAT has correct permissions
# PAT needs: read:packages scope
```

### Argo CD Not Syncing

```bash
# Check Argo CD application status
kubectl get applications -n argocd

# Check Argo CD application details
kubectl describe application dev-environment -n argocd

# Force sync
argocd app sync dev-environment --force
```

### Secret Not Being Used

```bash
# Verify deployment has imagePullSecrets
kubectl get deployment dev-backend -n dev -o yaml | grep -A 2 imagePullSecrets

# If missing, check if the deployment was updated
kubectl get deployment dev-backend -n dev -o yaml | grep ghcr-secret
```

## Security Best Practices

1. **Use fine-grained PATs** (not classic tokens)
2. **Set token expiration** (rotate regularly)
3. **Limit scope to `read:packages` only** (principle of least privilege)
4. **Store secrets securely** (use sealed-secrets or external-secrets in production)
5. **Use different PATs per environment** (dev, staging, prod)
6. **Monitor token usage** in GitHub settings

## Next Steps

After fixing the image pull issue:

1. Monitor Argo CD applications: `kubectl get applications -n argocd`
2. Verify all pods are healthy: `kubectl get pods -A`
3. Check application logs: `kubectl logs -n dev -l app=backend`
4. Access the applications via ingress:
   - Dev Frontend: https://dev.huberty.pro
   - Dev Backend API: https://api-dev.huberty.pro
   - Staging Frontend: https://staging.huberty.pro
   - Staging Backend API: https://api-staging.huberty.pro
   - Production Frontend: https://app.huberty.pro
   - Production Backend API: https://api.huberty.pro

## References

- [Kubernetes Documentation: Pull an Image from a Private Registry](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/)
- [GitHub Documentation: Working with the Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Argo CD Documentation: Private Repositories](https://argo-cd.readthedocs.io/en/stable/user-guide/private-repositories/)
