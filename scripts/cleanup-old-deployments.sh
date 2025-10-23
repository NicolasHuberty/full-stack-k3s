#!/bin/bash

# Script to clean up old backend/frontend deployments
# Run this after connecting to your K3s cluster

set -e

echo "========================================"
echo "Cleaning up old backend/frontend deployments"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to delete resource if it exists
delete_if_exists() {
    local resource_type=$1
    local resource_name=$2
    local namespace=$3

    if kubectl get $resource_type $resource_name -n $namespace &>/dev/null; then
        echo -e "${YELLOW}Deleting $resource_type/$resource_name from namespace $namespace${NC}"
        kubectl delete $resource_type $resource_name -n $namespace
        echo -e "${GREEN}✓ Deleted${NC}"
    else
        echo -e "${GREEN}✓ $resource_type/$resource_name not found in $namespace (already clean)${NC}"
    fi
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed or not in PATH${NC}"
    exit 1
fi

# Check cluster connectivity
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    echo "Please ensure you're connected to your K3s cluster"
    exit 1
fi

echo "Connected to cluster successfully"
echo ""

# Clean up dev namespace
echo -e "${YELLOW}=== Cleaning up DEV namespace ===${NC}"
delete_if_exists deployment dev-backend dev
delete_if_exists deployment dev-frontend dev
delete_if_exists deployment dev-redis dev
delete_if_exists service dev-backend dev
delete_if_exists service dev-frontend dev
delete_if_exists service dev-redis dev
delete_if_exists ingress rag-backend dev
delete_if_exists ingress rag-frontend dev
delete_if_exists configmap dev-env-config dev
echo ""

# Clean up staging namespace
echo -e "${YELLOW}=== Cleaning up STAGING namespace ===${NC}"
delete_if_exists deployment staging-backend staging
delete_if_exists deployment staging-frontend staging
delete_if_exists deployment staging-redis staging
delete_if_exists service staging-backend staging
delete_if_exists service staging-frontend staging
delete_if_exists service staging-redis staging
delete_if_exists ingress rag-backend staging
delete_if_exists ingress rag-frontend staging
delete_if_exists configmap staging-env-config staging
echo ""

# Clean up production namespace
echo -e "${YELLOW}=== Cleaning up PRODUCTION namespace ===${NC}"
delete_if_exists deployment prod-backend production
delete_if_exists deployment prod-frontend production
delete_if_exists deployment prod-redis production
delete_if_exists service prod-backend production
delete_if_exists service prod-frontend production
delete_if_exists service prod-redis production
delete_if_exists ingress rag-backend production
delete_if_exists ingress rag-frontend production
delete_if_exists configmap prod-env-config production
echo ""

echo -e "${GREEN}========================================"
echo "Cleanup complete!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Apply the new Docuralis manifests via ArgoCD"
echo "2. Verify deployments: kubectl get deployments -n dev"
echo "3. Check pods: kubectl get pods -n dev"
