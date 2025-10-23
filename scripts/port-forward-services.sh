#!/bin/bash

# Port forwarding script for private services
# This allows you to access private service GUIs from your local computer

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Port Forwarding for Private Services${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Export kubeconfig
export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml

echo -e "${YELLOW}Starting port forwarding for all private services...${NC}"
echo ""

# Function to start port forwarding in background
start_port_forward() {
    local service=$1
    local namespace=$2
    local local_port=$3
    local remote_port=$4
    local url=$5

    echo -e "${GREEN}▶ Forwarding ${service}${NC}"
    echo -e "  Local: http://localhost:${local_port}"
    echo -e "  Remote: ${namespace}/${service}:${remote_port}"

    kubectl port-forward -n ${namespace} svc/${service} ${local_port}:${remote_port} > /dev/null 2>&1 &
    local pid=$!
    echo -e "  PID: ${pid}"
    echo ""

    # Store PID for cleanup
    echo $pid >> /tmp/k3s-port-forward-pids.txt
}

# Clean up any existing port forwards
if [ -f /tmp/k3s-port-forward-pids.txt ]; then
    echo -e "${YELLOW}Cleaning up old port forwards...${NC}"
    while read pid; do
        kill $pid 2>/dev/null || true
    done < /tmp/k3s-port-forward-pids.txt
    rm /tmp/k3s-port-forward-pids.txt
    echo ""
fi

# Create PID file
touch /tmp/k3s-port-forward-pids.txt

# Start port forwarding for each service
start_port_forward "vault" "vault" "8200" "8200"
start_port_forward "argocd-server" "argocd" "8080" "80"
start_port_forward "grafana" "monitoring" "3001" "80"
start_port_forward "prometheus-server" "monitoring" "9090" "80"
start_port_forward "postgresql" "database" "5432" "5432"
start_port_forward "qdrant" "database" "6333" "6333"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All port forwards started!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${BLUE}Access your services at:${NC}"
echo ""
echo -e "  ${YELLOW}Vault UI:${NC}           http://localhost:8200"
echo -e "  ${YELLOW}ArgoCD UI:${NC}          http://localhost:8080"
echo -e "  ${YELLOW}Grafana UI:${NC}         http://localhost:3001"
echo -e "  ${YELLOW}Prometheus UI:${NC}      http://localhost:9090"
echo -e "  ${YELLOW}PostgreSQL:${NC}         localhost:5432"
echo -e "  ${YELLOW}Qdrant UI:${NC}          http://localhost:6333/dashboard"
echo ""

echo -e "${BLUE}Credentials:${NC}"
echo ""
echo -e "  ${YELLOW}Vault Token:${NC}        (stored in infra/VAULT_CREDENTIALS.md)"
echo -e "  ${YELLOW}ArgoCD:${NC}             (get password below)"
echo -e "  ${YELLOW}Grafana:${NC}            admin / (get password from secret)"
echo ""

echo -e "${BLUE}To get ArgoCD password:${NC}"
echo -e "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath=\"{.data.password}\" | base64 -d"
echo ""

echo -e "${BLUE}To get Grafana password:${NC}"
echo -e "  kubectl -n monitoring get secret grafana -o jsonpath=\"{.data.admin-password}\" | base64 -d"
echo ""

echo -e "${RED}Press Ctrl+C to stop all port forwards${NC}"
echo ""

# Wait and keep script running
trap "echo ''; echo 'Stopping port forwards...'; cat /tmp/k3s-port-forward-pids.txt | xargs kill 2>/dev/null; rm /tmp/k3s-port-forward-pids.txt; echo 'Done.'; exit" INT TERM

# Keep running
while true; do
    sleep 1
done
