# K3s Dashboard Fix Summary

## Problem
The dashboard was failing with the error:
```
Failed to fetch data from Kubernetes cluster
Make sure you have kubectl configured and can access your cluster.
```

## Root Cause
When the dashboard runs **inside** a Kubernetes pod (deployed on the k3s cluster), it needs to use **in-cluster authentication** via a ServiceAccount with proper RBAC permissions. The original code only tried to load from a kubeconfig file, which doesn't exist inside the pod.

## What I Fixed

### 1. Updated Kubernetes Client (lib/k8s-client.ts:5-25)
Modified the client to try in-cluster configuration first, then fall back to kubeconfig:

```typescript
export function getKubeConfig(): k8s.KubeConfig {
  if (!kc) {
    kc = new k8s.KubeConfig();

    // Try in-cluster config first (when running inside Kubernetes)
    try {
      kc.loadFromCluster();
      console.log('Using in-cluster Kubernetes configuration');
    } catch (e) {
      // Fall back to default config (kubeconfig file)
      try {
        kc.loadFromDefault();
        console.log('Using default Kubernetes configuration');
      } catch (err) {
        console.error('Failed to load Kubernetes configuration:', err);
        throw err;
      }
    }
  }
  return kc;
}
```

### 2. Created RBAC Configuration (apps/k3s-dashboard/k8s/rbac.yaml)
- **Namespace**: k3s-dashboard
- **ServiceAccount**: k3s-dashboard
- **ClusterRole**: k3s-dashboard-viewer with read permissions for:
  - Nodes, pods, services, namespaces, events
  - Pod logs
  - Deployments, replicasets, statefulsets, daemonsets
  - Metrics (CPU/memory usage)
- **ClusterRoleBinding**: Connects ServiceAccount to ClusterRole

### 3. Updated Deployment (apps/k3s-dashboard/k8s/deployment.yaml)
- Added `serviceAccountName: k3s-dashboard` to use in-cluster auth
- Added proper health probes (liveness and readiness)
- Added resource limits (CPU/memory)
- Configured proper environment variables

### 4. Created Deployment Tools
- `Dockerfile` - For building production images
- `k8s/deploy.sh` - Automated deployment script
- `upload-to-server.sh` - Script to upload code to the server
- `DEPLOYMENT.md` - Complete deployment guide

## What's Already Done ✓
- [x] RBAC configuration applied to cluster
- [x] ServiceAccount created (k3s-dashboard)
- [x] ClusterRole and ClusterRoleBinding configured
- [x] Deployment updated to use ServiceAccount
- [x] Updated code prepared for upload

## What You Need to Do

### Step 1: Upload Updated Code to Server
You need to upload the updated dashboard code (with the fixed k8s-client.ts) to your server:

```bash
cd /Users/nicolas/Documents/k3s-app/apps/k3s-dashboard
./upload-to-server.sh
```

This will:
1. Create a tar archive of the updated code
2. Upload it to your server at 217.182.170.104
3. Extract it to /opt/k3s-dashboard

**Note**: You'll be prompted for the SSH password for root@217.182.170.104

### Step 2: Restart the Deployment
After uploading the code, restart the pod to pick up the changes:

```bash
export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml
kubectl rollout restart deployment/k3s-dashboard -n k3s-dashboard
kubectl rollout status deployment/k3s-dashboard -n k3s-dashboard
```

### Step 3: Verify It's Working
Check that the pod is running:

```bash
kubectl get pods -n k3s-dashboard
```

Check the logs to confirm in-cluster auth is working:

```bash
kubectl logs -n k3s-dashboard -l app=k3s-dashboard -f
```

You should see:
```
Using in-cluster Kubernetes configuration
```

### Step 4: Access the Dashboard
Open your browser to:
```
http://217.182.170.104:30000
```

The error should now be gone and you should see your cluster data!

## Alternative: Manual Upload

If the upload script doesn't work, you can manually upload the code:

```bash
# From your local machine
cd /Users/nicolas/Documents/k3s-app/apps/k3s-dashboard
tar -czf /tmp/k3s-dashboard.tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=k8s \
  .

scp /tmp/k3s-dashboard.tar.gz root@217.182.170.104:/tmp/

# On the server (SSH into it)
ssh root@217.182.170.104
mkdir -p /opt/k3s-dashboard
tar -xzf /tmp/k3s-dashboard.tar.gz -C /opt/k3s-dashboard
rm /tmp/k3s-dashboard.tar.gz
exit

# Back on your local machine, restart the deployment
export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml
kubectl rollout restart deployment/k3s-dashboard -n k3s-dashboard
```

## How It Works Now

```
┌─────────────────────────────────────────┐
│         Browser                         │
│   http://217.182.170.104:30000          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      K3s Cluster                        │
│  ┌───────────────────────────────────┐  │
│  │  k3s-dashboard Pod                │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Next.js App                │  │  │
│  │  │  - Uses ServiceAccount      │  │  │
│  │  │  - In-cluster auth          │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  ServiceAccount: k3s-dashboard    │  │
│  └───────────────┬───────────────────┘  │
│                  │ Authenticated API    │
│                  │ calls with token     │
│  ┌───────────────▼───────────────────┐  │
│  │  Kubernetes API Server            │  │
│  │  - Validates ServiceAccount token │  │
│  │  - Checks RBAC permissions        │  │
│  │  - Returns cluster data           │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Troubleshooting

If you still see the error after following the steps:

1. **Check pod logs**:
   ```bash
   kubectl logs -n k3s-dashboard -l app=k3s-dashboard
   ```

2. **Verify ServiceAccount is configured**:
   ```bash
   kubectl get deployment k3s-dashboard -n k3s-dashboard -o jsonpath='{.spec.template.spec.serviceAccountName}'
   ```
   Should output: `k3s-dashboard`

3. **Check RBAC permissions**:
   ```bash
   kubectl auth can-i list pods --as=system:serviceaccount:k3s-dashboard:k3s-dashboard
   ```
   Should output: `yes`

4. **Verify code is on server**:
   ```bash
   ssh root@217.182.170.104 "ls -la /opt/k3s-dashboard/lib/k8s-client.ts"
   ```

## Files Created/Modified

### Modified:
- `lib/k8s-client.ts` - Updated to support in-cluster configuration
- `next.config.js` - Added standalone output for Docker builds

### Created:
- `k8s/rbac.yaml` - ServiceAccount and RBAC configuration
- `k8s/deployment.yaml` - Updated deployment with ServiceAccount
- `k8s/deploy.sh` - Automated deployment script
- `Dockerfile` - Production Docker image
- `upload-to-server.sh` - Upload script for code updates
- `DEPLOYMENT.md` - Complete deployment guide
- `FIX-SUMMARY.md` - This file

## Need Help?

If you encounter any issues, check:
1. Pod logs: `kubectl logs -n k3s-dashboard -l app=k3s-dashboard`
2. Pod status: `kubectl get pods -n k3s-dashboard`
3. Events: `kubectl get events -n k3s-dashboard --sort-by='.lastTimestamp'`
