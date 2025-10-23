#!/bin/bash

# Complete deployment script for Docuralis with docuralis.com domain
# This script will:
# 1. Clean up old backend/frontend deployments
# 2. Apply new Docuralis configurations
# 3. Verify deployments

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================"
echo "Docuralis Deployment Script"
echo "Domain: docuralis.com"
echo "========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    echo "Please ensure you're connected to your K3s cluster"
    exit 1
fi

echo -e "${GREEN}✓ kubectl is available${NC}"
echo -e "${GREEN}✓ Connected to cluster${NC}"
echo ""

# Ask for confirmation
read -p "This will remove old deployments and deploy Docuralis. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Step 1: Clean up old deployments
echo -e "${YELLOW}========================================"
echo "Step 1: Cleaning up old deployments"
echo "========================================${NC}"

bash "$(dirname "$0")/cleanup-old-deployments.sh" || true
echo ""

# Step 2: Update ExternalDNS (if not already synced by ArgoCD)
echo -e "${YELLOW}========================================"
echo "Step 2: Updating ExternalDNS configuration"
echo "========================================${NC}"

echo "ExternalDNS will be updated by ArgoCD to support docuralis.com"
echo "Manual sync: kubectl apply -f infra/apps/argocd/external-dns-app.yaml"
echo ""

# Step 3: Apply ArgoCD applications
echo -e "${YELLOW}========================================"
echo "Step 3: Applying ArgoCD applications"
echo "========================================${NC}"

if command -v argocd &> /dev/null; then
    echo "Syncing applications via ArgoCD CLI..."
    argocd app sync docuralis-dev --force || echo -e "${YELLOW}Warning: Could not sync dev app${NC}"
    argocd app sync docuralis-staging --force || echo -e "${YELLOW}Warning: Could not sync staging app${NC}"
    argocd app sync docuralis-production --force || echo -e "${YELLOW}Warning: Could not sync production app${NC}"
else
    echo -e "${YELLOW}ArgoCD CLI not available, please sync manually:${NC}"
    echo "  - Go to https://argocd.huberty.pro"
    echo "  - Sync docuralis-dev, docuralis-staging, docuralis-production"
fi
echo ""

# Step 4: Wait for deployments
echo -e "${YELLOW}========================================"
echo "Step 4: Waiting for deployments to roll out"
echo "========================================${NC}"

echo "Waiting for dev deployment..."
kubectl rollout status deployment/dev-docuralis -n dev --timeout=5m || echo -e "${YELLOW}Dev deployment still rolling out${NC}"

echo "Waiting for staging deployment..."
kubectl rollout status deployment/staging-docuralis -n staging --timeout=5m || echo -e "${YELLOW}Staging deployment still rolling out${NC}"

echo "Waiting for production deployment..."
kubectl rollout status deployment/prod-docuralis -n production --timeout=5m || echo -e "${YELLOW}Production deployment still rolling out${NC}"
echo ""

# Step 5: Verify deployments
echo -e "${YELLOW}========================================"
echo "Step 5: Verifying deployments"
echo "========================================${NC}"

echo -e "${BLUE}Dev environment:${NC}"
kubectl get pods -n dev -l app=docuralis
kubectl get ingress -n dev
echo ""

echo -e "${BLUE}Staging environment:${NC}"
kubectl get pods -n staging -l app=docuralis
kubectl get ingress -n staging
echo ""

echo -e "${BLUE}Production environment:${NC}"
kubectl get pods -n production -l app=docuralis
kubectl get ingress -n production
echo ""

# Step 6: Check DNS and certificates
echo -e "${YELLOW}========================================"
echo "Step 6: Checking DNS and certificates"
echo "========================================${NC}"

echo "Checking certificates..."
kubectl get certificates -n dev 2>/dev/null || echo "No certificates in dev yet"
kubectl get certificates -n staging 2>/dev/null || echo "No certificates in staging yet"
kubectl get certificates -n production 2>/dev/null || echo "No certificates in production yet"
echo ""

# Step 7: Test health endpoints (if DNS is ready)
echo -e "${YELLOW}========================================"
echo "Step 7: Testing health endpoints"
echo "========================================${NC}"

echo "Note: DNS propagation may take a few minutes"
echo ""

for domain in "dev.docuralis.com" "staging.docuralis.com" "app.docuralis.com"; do
    echo -e "${BLUE}Testing $domain...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" "https://$domain/api/health" --max-time 5 | grep -q "200"; then
        echo -e "${GREEN}✓ $domain is responding${NC}"
    else
        echo -e "${YELLOW}⚠ $domain is not responding yet (DNS or certificate pending)${NC}"
    fi
done
echo ""

# Summary
echo -e "${GREEN}========================================"
echo "Deployment Complete!"
echo "========================================${NC}"
echo ""
echo "Your applications should be available at:"
echo "  • Dev: https://dev.docuralis.com"
echo "  • Staging: https://staging.docuralis.com"
echo "  • Production: https://app.docuralis.com"
echo ""
echo "Next steps:"
echo "  1. Verify DNS records are pointing to 46.202.129.66"
echo "  2. Wait for TLS certificates (2-5 minutes)"
echo "  3. Test applications in your browser"
echo "  4. Run database migrations if needed"
echo ""
echo "Monitor deployments:"
echo "  kubectl logs -n dev -l app=docuralis -f"
echo "  kubectl logs -n staging -l app=docuralis -f"
echo "  kubectl logs -n production -l app=docuralis -f"
echo ""
echo "Check ArgoCD: https://argocd.huberty.pro"
