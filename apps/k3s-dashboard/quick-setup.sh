#!/bin/bash

# Quick Setup Script for K3s Dashboard
# Interactive prompts for easy setup

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}K3s Dashboard - Quick Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Prompt for server details
read -p "Enter remote server IP or hostname: " SERVER_HOST
read -p "Enter SSH user (default: root): " SSH_USER
SSH_USER=${SSH_USER:-root}

read -p "Enter SSH port (default: 22): " SSH_PORT
SSH_PORT=${SSH_PORT:-22}

# Use default SSH key discovery (no specific key needed)
AUTH_FLAG=""

# Always install K3s
K3S_FLAG=""

# Always deploy remotely
DEPLOY_FLAG="--deploy-remote"

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Configuration Summary:${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Server: $SSH_USER@$SERVER_HOST:$SSH_PORT"
echo "K3s Installation: Yes"
echo "Dashboard Mode: Remote"
echo "Dashboard URL: http://$SERVER_HOST:30000"
echo ""

read -p "Proceed with setup? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Setup cancelled"
    exit 0
fi

# Run the main setup script
echo ""
echo -e "${GREEN}Starting setup...${NC}"
echo ""

SCRIPT_DIR="$(dirname "$0")"
"$SCRIPT_DIR/setup-k3s-dashboard.sh" \
    --host "$SERVER_HOST" \
    --user "$SSH_USER" \
    --port "$SSH_PORT" \
    $DEPLOY_FLAG

echo ""
echo -e "${GREEN}Setup complete!${NC}"
