#!/bin/bash

# K3s Dashboard Deployment Script
# This script deploys the K3s dashboard to your Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

print_info "Deploying K3s Dashboard..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check cluster connectivity
print_info "Checking cluster connectivity..."
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster. Make sure KUBECONFIG is set correctly."
    echo "  Current KUBECONFIG: ${KUBECONFIG:-~/.kube/config}"
    exit 1
fi

print_success "Connected to cluster"

# Apply RBAC configuration
print_info "Applying RBAC configuration..."
kubectl apply -f "$SCRIPT_DIR/rbac.yaml"
print_success "RBAC configured"

# Check if /opt/k3s-dashboard exists on the node
print_info "Preparing application files..."

# Get the server IP from kubeconfig
if [ -n "$KUBECONFIG" ]; then
    SERVER_IP=$(grep -oP 'server: https://\K[^:]+' "$KUBECONFIG" 2>/dev/null || echo "")
else
    SERVER_IP=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' | grep -oP 'https://\K[^:]+')
fi

if [ -z "$SERVER_IP" ]; then
    print_warning "Could not determine server IP from kubeconfig"
    read -p "Enter your K3s server IP address: " SERVER_IP
fi

# Ask user if they want to upload the code
read -p "Do you want to upload the dashboard code to the server? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Uploading dashboard code to $SERVER_IP:/opt/k3s-dashboard..."

    # Create tar of the application
    TMP_TAR="/tmp/k3s-dashboard-$(date +%s).tar.gz"
    tar -czf "$TMP_TAR" -C "$APP_DIR" \
        --exclude=node_modules \
        --exclude=.next \
        --exclude=.git \
        --exclude=k8s \
        .

    # Upload to server
    if command -v ssh &> /dev/null; then
        ssh "root@$SERVER_IP" "mkdir -p /opt/k3s-dashboard"
        scp "$TMP_TAR" "root@$SERVER_IP:/tmp/k3s-dashboard.tar.gz"
        ssh "root@$SERVER_IP" "tar -xzf /tmp/k3s-dashboard.tar.gz -C /opt/k3s-dashboard && rm /tmp/k3s-dashboard.tar.gz"
        rm "$TMP_TAR"
        print_success "Code uploaded successfully"
    else
        print_warning "SSH not available. Please manually copy the app to /opt/k3s-dashboard on the server"
        print_info "Tar file created at: $TMP_TAR"
    fi
fi

# Apply deployment
print_info "Applying deployment configuration..."
kubectl apply -f "$SCRIPT_DIR/deployment.yaml"
print_success "Deployment created"

# Wait for deployment to be ready
print_info "Waiting for dashboard to be ready..."
if kubectl wait --for=condition=available --timeout=180s deployment/k3s-dashboard -n k3s-dashboard 2>/dev/null; then
    print_success "Dashboard is ready!"
else
    print_warning "Deployment is taking longer than expected"
    print_info "Check status with: kubectl get pods -n k3s-dashboard"
fi

# Get pod status
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ Dashboard Deployed Successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# Show access information
NODE_PORT=$(kubectl get svc k3s-dashboard -n k3s-dashboard -o jsonpath='{.spec.ports[0].nodePort}')
echo -e "${BLUE}Access Dashboard:${NC}"
echo -e "  URL: http://${SERVER_IP}:${NODE_PORT}"
echo ""

echo -e "${BLUE}Useful Commands:${NC}"
echo "  View pods:     kubectl get pods -n k3s-dashboard"
echo "  View logs:     kubectl logs -n k3s-dashboard -l app=k3s-dashboard -f"
echo "  View service:  kubectl get svc -n k3s-dashboard"
echo "  Delete:        kubectl delete -f $SCRIPT_DIR/"
echo ""

# Show pod status
print_info "Current pod status:"
kubectl get pods -n k3s-dashboard

echo ""
