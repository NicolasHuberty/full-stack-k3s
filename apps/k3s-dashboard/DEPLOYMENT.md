# K3s Dashboard Deployment Guide

This guide explains how to deploy the K3s Dashboard directly to your Kubernetes cluster.

## Prerequisites

- K3s cluster running and accessible
- `kubectl` configured to access your cluster
- SSH access to your K3s server (for uploading code)

## Quick Deploy

The easiest way to deploy the dashboard is using the deployment script:

```bash
cd apps/k3s-dashboard/k8s
./deploy.sh
```

This script will:
1. Create the namespace and ServiceAccount
2. Set up RBAC permissions (ClusterRole and ClusterRoleBinding)
3. Upload the dashboard code to the server
4. Deploy the application
5. Create a NodePort service for access

## Manual Deployment

If you prefer to deploy manually:

### 1. Set your kubeconfig

```bash
export KUBECONFIG=/path/to/your/kubeconfig.yml
```

### 2. Upload dashboard code to the server

```bash
# Create directory on server
ssh root@YOUR_SERVER_IP "mkdir -p /opt/k3s-dashboard"

# Create tar of app (excluding build artifacts)
tar -czf /tmp/k3s-dashboard.tar.gz \
  -C apps/k3s-dashboard \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=k8s \
  .

# Upload to server
scp /tmp/k3s-dashboard.tar.gz root@YOUR_SERVER_IP:/tmp/
ssh root@YOUR_SERVER_IP "tar -xzf /tmp/k3s-dashboard.tar.gz -C /opt/k3s-dashboard && rm /tmp/k3s-dashboard.tar.gz"
```

### 3. Apply Kubernetes manifests

```bash
# Apply RBAC (namespace, serviceaccount, clusterrole, clusterrolebinding)
kubectl apply -f apps/k3s-dashboard/k8s/rbac.yaml

# Apply deployment and service
kubectl apply -f apps/k3s-dashboard/k8s/deployment.yaml
```

### 4. Wait for deployment

```bash
kubectl wait --for=condition=available --timeout=180s deployment/k3s-dashboard -n k3s-dashboard
```

## Access the Dashboard

After deployment, the dashboard is accessible via NodePort:

```bash
# Get the NodePort
kubectl get svc k3s-dashboard -n k3s-dashboard

# Access at:
# http://YOUR_SERVER_IP:30000
```

## Architecture

The deployment includes:

### RBAC Configuration
- **Namespace**: `k3s-dashboard`
- **ServiceAccount**: `k3s-dashboard` - Used by the pod for in-cluster authentication
- **ClusterRole**: `k3s-dashboard-viewer` - Read-only permissions for:
  - Nodes (get, list, watch)
  - Pods, services, namespaces, events (get, list, watch)
  - Pod logs (get, list, watch)
  - Deployments, replicasets, statefulsets, daemonsets (get, list, watch)
  - Metrics (get, list) - for CPU/memory usage
- **ClusterRoleBinding**: Binds the ClusterRole to the ServiceAccount

### Deployment
- **Replicas**: 1
- **Image**: node:18-alpine
- **Service Account**: k3s-dashboard (enables in-cluster authentication)
- **Probes**: Liveness and readiness probes on HTTP port 3000
- **Resources**:
  - Requests: 100m CPU, 256Mi memory
  - Limits: 500m CPU, 512Mi memory
- **Volume**: HostPath mount from `/opt/k3s-dashboard` (code location on server)

### Service
- **Type**: NodePort
- **Port**: 3000
- **NodePort**: 30000

## How In-Cluster Authentication Works

The dashboard uses the Kubernetes client library which automatically detects when it's running inside a cluster:

1. The pod has a ServiceAccount token mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`
2. The k8s client (`lib/k8s-client.ts`) tries `loadFromCluster()` first
3. This uses the ServiceAccount token to authenticate with the Kubernetes API
4. The RBAC permissions determine what the dashboard can access

## Troubleshooting

### Check pod status
```bash
kubectl get pods -n k3s-dashboard
```

### View pod logs
```bash
kubectl logs -n k3s-dashboard -l app=k3s-dashboard -f
```

### Check RBAC permissions
```bash
kubectl auth can-i list pods --as=system:serviceaccount:k3s-dashboard:k3s-dashboard
```

### Common Issues

**Error: "Failed to fetch data from Kubernetes cluster"**
- Check that the ServiceAccount is properly bound to the ClusterRole
- Verify RBAC permissions with `kubectl auth can-i`
- Check pod logs for authentication errors

**Pod stuck in CrashLoopBackOff**
- Check if `/opt/k3s-dashboard` exists on the node and contains the app code
- View logs: `kubectl logs -n k3s-dashboard -l app=k3s-dashboard`
- The pod needs to run `npm install` on first start, which can take 30-60 seconds

**Cannot access dashboard at NodePort**
- Verify the service: `kubectl get svc -n k3s-dashboard`
- Check firewall rules on the server for port 30000
- Ensure the pod is running: `kubectl get pods -n k3s-dashboard`

## Updating the Dashboard

To update the dashboard code:

```bash
# Upload new code to server
tar -czf /tmp/k3s-dashboard.tar.gz -C apps/k3s-dashboard --exclude=node_modules --exclude=.next .
scp /tmp/k3s-dashboard.tar.gz root@YOUR_SERVER_IP:/tmp/
ssh root@YOUR_SERVER_IP "tar -xzf /tmp/k3s-dashboard.tar.gz -C /opt/k3s-dashboard && rm /tmp/k3s-dashboard.tar.gz"

# Restart the deployment
kubectl rollout restart deployment/k3s-dashboard -n k3s-dashboard
```

## Uninstalling

To remove the dashboard:

```bash
kubectl delete -f apps/k3s-dashboard/k8s/
```

Or manually:

```bash
kubectl delete namespace k3s-dashboard
kubectl delete clusterrole k3s-dashboard-viewer
kubectl delete clusterrolebinding k3s-dashboard-viewer
```
