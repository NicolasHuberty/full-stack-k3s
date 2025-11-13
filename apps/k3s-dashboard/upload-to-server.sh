#!/bin/bash

# Upload Dashboard Code to K3s Server
# This script uploads the dashboard code to the server at /opt/k3s-dashboard

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SERVER_IP="217.182.170.104"
SERVER_USER="root"
SERVER_PATH="/opt/k3s-dashboard"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}[INFO]${NC} Uploading dashboard code to server..."
echo -e "${BLUE}[INFO]${NC} Server: $SERVER_USER@$SERVER_IP"
echo -e "${BLUE}[INFO]${NC} Destination: $SERVER_PATH"
echo ""

# Create tar file
echo -e "${BLUE}[INFO]${NC} Creating archive..."
TAR_FILE="/tmp/k3s-dashboard-$(date +%s).tar.gz"
tar -czf "$TAR_FILE" \
    -C "$SCRIPT_DIR" \
    --exclude=node_modules \
    --exclude=.next \
    --exclude=.git \
    --exclude='k8s' \
    .

echo -e "${GREEN}[SUCCESS]${NC} Archive created: $TAR_FILE"
ls -lh "$TAR_FILE"
echo ""

# Upload to server
echo -e "${BLUE}[INFO]${NC} Uploading to server (you may be prompted for password)..."
if scp "$TAR_FILE" "$SERVER_USER@$SERVER_IP:/tmp/k3s-dashboard.tar.gz"; then
    echo -e "${GREEN}[SUCCESS]${NC} Upload complete"
else
    echo -e "${RED}[ERROR]${NC} Upload failed"
    exit 1
fi

# Extract on server
echo -e "${BLUE}[INFO]${NC} Extracting on server..."
if ssh "$SERVER_USER@$SERVER_IP" "mkdir -p $SERVER_PATH && tar -xzf /tmp/k3s-dashboard.tar.gz -C $SERVER_PATH && rm /tmp/k3s-dashboard.tar.gz"; then
    echo -e "${GREEN}[SUCCESS]${NC} Code extracted to $SERVER_PATH"
else
    echo -e "${RED}[ERROR]${NC} Extraction failed"
    exit 1
fi

# Clean up local tar
rm "$TAR_FILE"

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ Upload Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${BLUE}[INFO]${NC} Now restart the pod to pick up the changes:"
echo -e "  export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml"
echo -e "  kubectl rollout restart deployment/k3s-dashboard -n k3s-dashboard"
echo ""
