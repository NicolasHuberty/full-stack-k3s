# K3s Dashboard - Setup Guide

This guide explains how to set up the K3s Dashboard on a remote server.

## Quick Setup (Interactive)

The easiest way to get started:

```bash
./quick-setup.sh
```

This interactive script will:
1. Prompt you for server details (IP, user, port)
2. Ask for authentication method (SSH key or password)
3. Optionally install K3s on the remote server
4. Configure the dashboard (local or remote deployment)
5. Return the dashboard URL

## Advanced Setup (Command Line)

For automation or advanced configurations:

```bash
./setup-k3s-dashboard.sh --host <SERVER_IP> [OPTIONS]
```

### Options

- `--host HOST` - Remote server IP or hostname (required)
- `--user USER` - SSH user (default: root)
- `--port PORT` - SSH port (default: 22)
- `--key KEY_FILE` - SSH private key file (default: ~/.ssh/id_rsa)
- `--password` - Use password authentication instead of key
- `--skip-k3s` - Skip K3s installation (use existing cluster)
- `--deploy-remote` - Deploy dashboard to remote cluster
- `--help` - Show help message

### Examples

#### 1. Fresh K3s Installation + Local Dashboard

Install K3s and monitor it locally from your machine:

```bash
./setup-k3s-dashboard.sh \
  --host 192.168.1.100 \
  --user ubuntu \
  --key ~/.ssh/my-key.pem
```

This will:
- Connect to the server
- Install K3s
- Download kubeconfig
- Configure local dashboard

**Dashboard URL**: http://localhost:3000 (after running `./run-dashboard.sh`)

#### 2. Use Existing K3s + Local Dashboard

Connect to an existing K3s cluster:

```bash
./setup-k3s-dashboard.sh \
  --host 192.168.1.100 \
  --user root \
  --skip-k3s
```

**Dashboard URL**: http://localhost:3000 (after running `./run-dashboard.sh`)

#### 3. Fresh K3s + Remote Dashboard

Install K3s and deploy the dashboard to the cluster:

```bash
./setup-k3s-dashboard.sh \
  --host 192.168.1.100 \
  --user ubuntu \
  --deploy-remote
```

**Dashboard URL**: http://192.168.1.100:30000

#### 4. Password Authentication

Use password instead of SSH key:

```bash
./setup-k3s-dashboard.sh \
  --host 192.168.1.100 \
  --user root \
  --password
```

You'll be prompted for the password during connection.

## Deployment Modes

### Local Dashboard (Default)

The dashboard runs on your local machine and connects to the remote K3s cluster.

**Advantages:**
- No additional resources on the cluster
- Easy to restart and debug
- Works with any K3s cluster

**How to use:**
```bash
# After setup completes:
./run-dashboard.sh

# Opens at: http://localhost:3000
```

### Remote Dashboard

The dashboard is deployed as a pod in the K3s cluster.

**Advantages:**
- Always accessible at a fixed URL
- No need to keep local machine running
- Can be accessed from anywhere

**How to use:**
```bash
# Use --deploy-remote flag during setup
./setup-k3s-dashboard.sh --host <IP> --deploy-remote

# Opens at: http://<SERVER_IP>:30000
```

## What the Script Does

1. **SSH Connection Test**
   - Validates SSH credentials
   - Tests connection to remote server

2. **K3s Installation** (if not skipped)
   - Downloads and installs K3s
   - Waits for cluster to be ready
   - Verifies installation

3. **Kubeconfig Retrieval**
   - Downloads K3s kubeconfig
   - Replaces localhost with actual server IP
   - Saves to `../../kubeconfig.yml`
   - Tests kubectl connection

4. **Dashboard Setup**

   **Local Mode:**
   - Creates `.env.local` with kubeconfig path
   - Provides commands to start dashboard

   **Remote Mode:**
   - Creates Kubernetes namespace
   - Deploys dashboard as a pod
   - Exposes on NodePort 30000
   - Waits for deployment to be ready

5. **Verification**
   - Lists cluster nodes
   - Displays dashboard URL
   - Shows setup summary

## Troubleshooting

### SSH Connection Failed

```bash
# Test SSH manually
ssh -i ~/.ssh/id_rsa user@server

# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa
```

### K3s Installation Failed

```bash
# SSH into server and check logs
ssh user@server
sudo journalctl -u k3s -f

# Check if K3s is running
sudo systemctl status k3s
```

### kubectl Connection Failed

```bash
# Verify kubeconfig
export KUBECONFIG=../../kubeconfig.yml
kubectl get nodes

# Check server IP in kubeconfig
cat ../../kubeconfig.yml | grep server:
```

### Dashboard Not Loading (Local)

```bash
# Ensure kubeconfig is set
export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml

# Test cluster connection
kubectl get nodes

# Install dependencies
npm install

# Start dashboard
./run-dashboard.sh
```

### Dashboard Not Loading (Remote)

```bash
# Check pod status
kubectl get pods -n k3s-dashboard

# Check logs
kubectl logs -n k3s-dashboard deployment/k3s-dashboard

# Check service
kubectl get svc -n k3s-dashboard

# Test from server
ssh user@server
curl http://localhost:30000
```

## Security Considerations

1. **Firewall**: If using remote deployment, ensure port 30000 is accessible
2. **SSH Keys**: Always use SSH keys instead of passwords for production
3. **RBAC**: The dashboard has full cluster access via kubeconfig
4. **Network**: Consider using a VPN or firewall rules to restrict access

## Manual Setup (Alternative)

If you prefer manual setup:

### 1. Install K3s on Remote Server

```bash
ssh user@server
curl -sfL https://get.k3s.io | sh -
```

### 2. Get Kubeconfig

```bash
# On remote server
sudo cat /etc/rancher/k3s/k3s.yaml

# On local machine - save to file and edit
# Replace 127.0.0.1 with actual server IP
```

### 3. Run Dashboard Locally

```bash
cd /Users/nicolas/Documents/k3s-app/apps/k3s-dashboard
export KUBECONFIG=/path/to/kubeconfig.yml
npm install
./run-dashboard.sh
```

## Next Steps

After setup:

1. Open the dashboard URL
2. Explore cluster resources, nodes, services, and pods
3. Monitor CPU, memory, and storage usage
4. View pod logs for debugging
5. Track deployments and services

The dashboard auto-refreshes every 10 seconds for real-time monitoring.
