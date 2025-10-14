#!/bin/bash
# Script to create image pull secrets for GitHub Container Registry
# This allows Kubernetes to pull private Docker images from ghcr.io

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== GitHub Container Registry Image Pull Secret Setup ===${NC}\n"

# Check if required tools are installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Prompt for credentials
read -p "Enter your GitHub username [NicolasHuberty]: " GITHUB_USERNAME
GITHUB_USERNAME=${GITHUB_USERNAME:-NicolasHuberty}

read -p "Enter your GitHub email: " GITHUB_EMAIL

echo -e "\n${YELLOW}To create a Personal Access Token (PAT):${NC}"
echo "1. Go to: https://github.com/settings/tokens/new"
echo "2. Give it a name: 'K3s Container Registry Pull'"
echo "3. Select scopes: 'read:packages'"
echo "4. Click 'Generate token'"
echo "5. Copy the token"
echo ""

read -sp "Enter your GitHub Personal Access Token (PAT): " GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GitHub token is required${NC}"
    exit 1
fi

if [ -z "$GITHUB_EMAIL" ]; then
    echo -e "${RED}Error: GitHub email is required${NC}"
    exit 1
fi

# Create namespaces if they don't exist
for namespace in dev staging production; do
    if ! kubectl get namespace $namespace &> /dev/null; then
        echo -e "${YELLOW}Creating namespace: $namespace${NC}"
        kubectl create namespace $namespace
    fi
done

# Create secrets in each namespace
for namespace in dev staging production; do
    echo -e "\n${YELLOW}Creating secret in namespace: $namespace${NC}"

    # Delete existing secret if it exists
    if kubectl get secret ghcr-secret -n $namespace &> /dev/null; then
        echo -e "${YELLOW}Deleting existing secret...${NC}"
        kubectl delete secret ghcr-secret -n $namespace
    fi

    # Create new secret
    kubectl create secret docker-registry ghcr-secret \
        --docker-server=ghcr.io \
        --docker-username="$GITHUB_USERNAME" \
        --docker-password="$GITHUB_TOKEN" \
        --docker-email="$GITHUB_EMAIL" \
        -n $namespace

    echo -e "${GREEN}✓ Secret created in $namespace${NC}"
done

echo -e "\n${GREEN}=== Setup Complete ===${NC}"
echo -e "\nThe image pull secrets have been created in all namespaces."
echo -e "Argo CD will automatically sync and redeploy the applications."
echo -e "\nTo check the status:"
echo -e "  kubectl get pods -n dev"
echo -e "  kubectl get pods -n staging"
echo -e "  kubectl get pods -n production"
echo -e "\nTo check Argo CD applications:"
echo -e "  kubectl get applications -n argocd"
