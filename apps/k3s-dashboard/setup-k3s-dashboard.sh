#!/bin/bash

# K3s Dashboard Remote Setup Script
# This script connects to a remote server, installs K3s, and sets up monitoring

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

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    -h, --host HOST          Remote server hostname or IP (required)
    -u, --user USER          SSH user (default: root)
    -p, --port PORT          SSH port (default: 22)
    -k, --key KEY_FILE       SSH private key file (optional, uses default SSH key discovery)
    --password               Use password authentication
    --skip-k3s               Skip K3s installation (use existing cluster)
    --deploy-remote          Deploy dashboard to remote cluster (default: local)
    --help                   Show this help message

Examples:
    # Install K3s and deploy dashboard remotely (uses default SSH keys)
    $0 --host 192.168.1.100 --user ubuntu --deploy-remote

    # Use existing K3s installation with specific SSH key
    $0 --host 192.168.1.100 --skip-k3s --key ~/.ssh/my-key.pem

    # Deploy dashboard to remote cluster
    $0 --host 192.168.1.100 --deploy-remote

EOF
}

# Default values
SSH_USER="root"
SSH_PORT="22"
SSH_KEY=""
USE_PASSWORD=false
SKIP_K3S=false
DEPLOY_REMOTE=false
SSH_HOST=""
USE_SPECIFIC_KEY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            SSH_HOST="$2"
            shift 2
            ;;
        -u|--user)
            SSH_USER="$2"
            shift 2
            ;;
        -p|--port)
            SSH_PORT="$2"
            shift 2
            ;;
        -k|--key)
            SSH_KEY="$2"
            USE_SPECIFIC_KEY=true
            shift 2
            ;;
        --password)
            USE_PASSWORD=true
            shift
            ;;
        --skip-k3s)
            SKIP_K3S=true
            shift
            ;;
        --deploy-remote)
            DEPLOY_REMOTE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$SSH_HOST" ]; then
    print_error "Host is required"
    show_usage
    exit 1
fi

# Build SSH command
if [ "$USE_PASSWORD" = true ]; then
    SSH_CMD="ssh -T -o LogLevel=ERROR -p $SSH_PORT $SSH_USER@$SSH_HOST"
    SCP_CMD="scp -q -P $SSH_PORT"
elif [ "$USE_SPECIFIC_KEY" = true ]; then
    if [ ! -f "$SSH_KEY" ]; then
        print_error "SSH key file not found: $SSH_KEY"
        exit 1
    fi
    SSH_CMD="ssh -T -o LogLevel=ERROR -i $SSH_KEY -p $SSH_PORT $SSH_USER@$SSH_HOST"
    SCP_CMD="scp -q -i $SSH_KEY -P $SSH_PORT"
else
    # Use default SSH key discovery (tries ~/.ssh/id_rsa, ~/.ssh/id_ed25519, etc.)
    SSH_CMD="ssh -T -o LogLevel=ERROR -p $SSH_PORT $SSH_USER@$SSH_HOST"
    SCP_CMD="scp -q -P $SSH_PORT"
fi

print_info "Connecting to $SSH_USER@$SSH_HOST:$SSH_PORT"

# Test SSH connection
if ! $SSH_CMD "echo 'SSH connection successful'" > /dev/null 2>&1; then
    print_error "Failed to connect to remote server"
    exit 1
fi

print_success "SSH connection established"

# Install K3s if not skipped
if [ "$SKIP_K3S" = false ]; then
    print_info "Installing K3s on remote server..."

    $SSH_CMD << 'REMOTE_INSTALL_K3S' 2>&1 | grep -E "K3s is|Installing K3s|version|nodes are ready|ERROR"
        # Check if K3s is already installed
        if command -v k3s &> /dev/null; then
            echo "✓ K3s is already installed ($(k3s --version | head -n1))"
        else
            echo "→ Installing K3s..."
            curl -sfL https://get.k3s.io | sh - > /dev/null 2>&1

            # Wait for K3s to be ready
            sleep 10

            # Check if K3s is running
            if systemctl is-active --quiet k3s; then
                # Wait for node to be ready
                for i in {1..30}; do
                    if sudo k3s kubectl get nodes 2>/dev/null | grep -q "Ready"; then
                        echo "✓ K3s installed and running (v$(k3s --version | head -n1 | cut -d' ' -f3))"
                        NODE_COUNT=$(sudo k3s kubectl get nodes --no-headers 2>/dev/null | wc -l)
                        echo "✓ Cluster ready with $NODE_COUNT node(s)"
                        break
                    fi
                    sleep 2
                done
            else
                echo "ERROR: K3s failed to start"
                exit 1
            fi
        fi
REMOTE_INSTALL_K3S

    if [ $? -eq 0 ]; then
        print_success "K3s installation complete"
    else
        print_error "Failed to install K3s"
        exit 1
    fi
else
    print_info "Skipping K3s installation (using existing cluster)"
fi

# Retrieve kubeconfig
print_info "Retrieving kubeconfig..."

# Create local directory for kubeconfig
KUBECONFIG_DIR="$(dirname "$0")/../../"
mkdir -p "$KUBECONFIG_DIR" 2>/dev/null

# Get the kubeconfig and replace localhost with actual IP
if $SSH_CMD "sudo cat /etc/rancher/k3s/k3s.yaml" 2>/dev/null | \
    sed "s/127.0.0.1/$SSH_HOST/g" > "$KUBECONFIG_DIR/kubeconfig.yml"; then
    print_success "Kubeconfig retrieved"
else
    print_error "Failed to retrieve kubeconfig (check sudo permissions)"
    exit 1
fi

# Test kubectl connection
print_info "Testing kubectl connection..."
export KUBECONFIG="$KUBECONFIG_DIR/kubeconfig.yml"

if kubectl get nodes &> /dev/null; then
    print_success "kubectl connected successfully"
    NODE_INFO=$(kubectl get nodes --no-headers 2>/dev/null | awk '{print $1" ("$2")"}' | paste -sd ", " -)
    echo "  Nodes: $NODE_INFO"
else
    print_error "Failed to connect with kubectl"
    exit 1
fi

# Deploy dashboard (remote or local)
if [ "$DEPLOY_REMOTE" = true ]; then
    print_info "Deploying dashboard to remote K3s cluster..."

    cat > /tmp/k3s-dashboard-namespace.yaml << 'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: k3s-dashboard
EOF

    cat > /tmp/k3s-dashboard-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: k3s-dashboard
  namespace: k3s-dashboard
spec:
  replicas: 1
  selector:
    matchLabels:
      app: k3s-dashboard
  template:
    metadata:
      labels:
        app: k3s-dashboard
    spec:
      containers:
      - name: dashboard
        image: node:18-alpine
        workingDir: /app
        command: ["/bin/sh", "-c"]
        args:
          - |
            npm install && npm run dev
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: app-code
          mountPath: /app
      volumes:
      - name: app-code
        hostPath:
          path: /opt/k3s-dashboard
          type: DirectoryOrCreate
---
apiVersion: v1
kind: Service
metadata:
  name: k3s-dashboard
  namespace: k3s-dashboard
spec:
  type: NodePort
  selector:
    app: k3s-dashboard
  ports:
  - port: 3000
    targetPort: 3000
    nodePort: 30000
EOF

    # Copy dashboard code to remote server
    print_info "Uploading dashboard to server..."
    $SSH_CMD "sudo mkdir -p /opt/k3s-dashboard" > /dev/null 2>&1

    # Upload the app
    tar -czf /tmp/k3s-dashboard.tar.gz -C "$(dirname "$0")" . 2>/dev/null
    $SCP_CMD /tmp/k3s-dashboard.tar.gz $SSH_USER@$SSH_HOST:/tmp/ > /dev/null 2>&1
    $SSH_CMD "sudo tar -xzf /tmp/k3s-dashboard.tar.gz -C /opt/k3s-dashboard && sudo rm /tmp/k3s-dashboard.tar.gz" > /dev/null 2>&1

    print_success "Dashboard code uploaded"

    # Deploy to cluster
    print_info "Creating Kubernetes resources..."
    kubectl apply -f /tmp/k3s-dashboard-namespace.yaml > /dev/null 2>&1
    kubectl apply -f /tmp/k3s-dashboard-deployment.yaml > /dev/null 2>&1

    # Wait for deployment
    print_info "Starting dashboard pods (this may take 1-2 minutes)..."
    if kubectl wait --for=condition=available --timeout=180s deployment/k3s-dashboard -n k3s-dashboard > /dev/null 2>&1; then
        print_success "Dashboard deployed successfully"
    else
        print_warning "Deployment is taking longer than expected, but may still succeed"
        print_info "Check status with: kubectl get pods -n k3s-dashboard"
    fi

    rm -f /tmp/k3s-dashboard-*.yaml /tmp/k3s-dashboard.tar.gz
else
    # Local monitoring setup
    print_info "Setting up local dashboard..."

    # Update .env.local with new kubeconfig path
    echo "KUBECONFIG=$KUBECONFIG_DIR/kubeconfig.yml" > "$(dirname "$0")/.env.local"

    print_success "Local dashboard configured"
    print_info ""
    print_info "To start the dashboard locally, run:"
    print_info "  cd $(dirname "$0")"
    print_info "  ./run-dashboard.sh"
    print_info ""
    print_info "Dashboard will be available at: http://localhost:3000"
fi

# Print summary
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

if [ "$DEPLOY_REMOTE" = true ]; then
    echo -e "${BLUE}Dashboard URL:${NC}  http://$SSH_HOST:30000"
else
    echo -e "${BLUE}Dashboard:${NC}      Run './run-dashboard.sh' then open http://localhost:3000"
fi

echo -e "${BLUE}Server:${NC}         $SSH_USER@$SSH_HOST:$SSH_PORT"
echo -e "${BLUE}Kubeconfig:${NC}     $KUBECONFIG_DIR/kubeconfig.yml"

NODE_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')
POD_COUNT=$(kubectl get pods -A --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo -e "${BLUE}Cluster:${NC}        $NODE_COUNT node(s), $POD_COUNT pod(s)"

echo ""
echo -e "${YELLOW}Next steps:${NC}"
if [ "$DEPLOY_REMOTE" = true ]; then
    echo "  • Open http://$SSH_HOST:30000 in your browser"
    echo "  • Monitor cluster resources in real-time"
else
    echo "  • cd $(dirname "$0")"
    echo "  • ./run-dashboard.sh"
    echo "  • Open http://localhost:3000"
fi

echo ""
