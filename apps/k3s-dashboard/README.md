# K3s Dashboard

A Next.js dashboard for monitoring your Kubernetes cluster in real-time with comprehensive resource tracking and hierarchical service-pod views.

## Quick Start

### Automated Setup (Recommended)

The fastest way to set up K3s and the dashboard on a remote server:

```bash
./quick-setup.sh
```

This interactive script will guide you through:
- Connecting to your server via SSH
- Installing K3s (optional)
- Setting up the dashboard
- Providing the dashboard URL

**For advanced options and examples**, see [SETUP.md](./SETUP.md)

### Manual Local Setup

If you already have a K3s cluster running:

```bash
# Install dependencies
npm install

# Set kubeconfig path
export KUBECONFIG=/path/to/your/kubeconfig.yml

# Start the dashboard
./run-dashboard.sh
```

Open http://localhost:3000

## Features

- **Real-time Resource Monitoring** (auto-refreshes every 10 seconds)
  - Cluster-wide CPU, Memory, Storage, and Pod statistics
  - Live usage percentages with visual progress bars
  - Color-coded warnings when resources exceed 80% usage

- **Comprehensive Node Monitoring**
  - Node status and health
  - CPU and Memory usage with percentage breakdown
  - Storage capacity and allocation
  - Network information (Internal IP, hostname)
  - Kubernetes version per node

- **Pod Resource Tracking**
  - CPU and Memory usage per pod
  - Pod status with color-coded indicators
  - Restart counts and age tracking
  - Live log viewer for debugging

- **Hierarchical Service-Pod View**
  - Services displayed as expandable cards
  - Aggregated resource usage per service
  - Click to expand and see all pods under each service
  - Real-time CPU and memory metrics for services and pods
  - Resource requests and limits tracking

- **Infrastructure Overview**
  - View all deployments across namespaces
  - Monitor all services with type, IPs, and ports
  - Track resource allocation vs usage
  - Dark theme optimized UI

## Prerequisites

- Node.js 18+ installed
- kubectl configured and connected to your K3s cluster
- Kubernetes config file (default: `~/.kube/config` or set via `KUBECONFIG` env var)
- **metrics-server** installed in your cluster (required for resource usage monitoring)
  - K3s includes metrics-server by default
  - Verify with: `kubectl top nodes`

## Verify kubectl connection

Before running the dashboard, make sure kubectl is connected to your cluster:

```bash
kubectl cluster-info
kubectl get nodes
```

## Installation

```bash
npm install
```

## Running the Dashboard

### Option 1: Using the helper script (recommended for custom kubeconfig)

If your kubeconfig is not in the default location:

```bash
# The script automatically sets KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml
./run-dashboard.sh
```

### Option 2: Standard npm command

For default kubeconfig location (`~/.kube/config`):

```bash
npm run dev
```

### Option 3: Custom kubeconfig path

```bash
export KUBECONFIG=/path/to/your/kubeconfig.yml
npm run dev
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000)

## Features Overview

### Cluster Resource Overview
- **Real-time cluster-wide metrics**
  - CPU: Current usage vs allocatable capacity with percentage
  - Memory: Live memory consumption across all nodes (in GiB)
  - Storage: Total ephemeral storage capacity and allocation
  - Pods: Running pods vs total pods
- Visual progress bars with color-coded warnings (green < 80%, red >= 80%)
- Auto-refresh every 10 seconds

### Nodes View
- **Complete node resource monitoring:**
  - CPU usage: current cores used / allocatable cores with percentage
  - Memory usage: current GiB used / allocatable GiB with percentage
  - Storage capacity per node
  - Network information (Internal IP address, hostname)
  - Node status (Ready/NotReady) with color indicators
  - Node roles (control-plane, master, worker)
  - Kubernetes version per node
  - Age of each node
- Visual mini progress bars for CPU and memory usage per node

### Pods View
- **Resource usage per pod:**
  - CPU usage in cores
  - Memory usage in MiB
  - Pod status with color-coded indicators (green=running, yellow=pending, red=failed)
  - Restart counts to track stability
  - Node assignment
  - Namespace and pod age
  - View logs button for each pod

### Deployments View
- All deployments across all namespaces
- Ready status (ready/total replicas)
- Up-to-date replicas
- Available replicas
- Deployment age

### Services View
- All services across all namespaces
- Service type (ClusterIP, NodePort, LoadBalancer)
- Cluster IP addresses
- Port mappings with protocols
- Service age

### Logs Viewer
- Click "View Logs" on any pod to see its logs
- Shows last 100 lines of logs
- Real-time log viewing for debugging

## How It Works

The dashboard uses the official `@kubernetes/client-node` library to connect to your Kubernetes cluster using your kubectl configuration. All API calls are made server-side through Next.js API routes for security.

## Troubleshooting

### "Failed to fetch data from Kubernetes cluster"

1. Make sure kubectl is properly configured:
   ```bash
   kubectl config current-context
   kubectl cluster-info
   ```

2. Verify you have permissions to access cluster resources:
   ```bash
   kubectl get nodes
   kubectl get pods --all-namespaces
   ```

3. Check that your kubeconfig file exists:
   ```bash
   ls -la ~/.kube/config
   ```

### Dashboard not connecting

- Ensure your K3s cluster is running
- Check that you're in the correct kubectl context
- Verify your user has necessary RBAC permissions

## Development

```bash
npm run dev     # Start development server
npm run build   # Build for production
npm run start   # Start production server
```

## Architecture

- Frontend: React with Next.js 14 (App Router)
- Backend: Next.js API Routes
- Kubernetes Client: @kubernetes/client-node
- Styling: CSS Modules
