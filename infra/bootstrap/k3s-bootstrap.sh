#!/bin/bash
#
# K3s Multi-Node Bootstrap Script
# This script installs K3s on master and agent nodes
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - Customize these variables
CLUSTER_DOMAIN="${CLUSTER_DOMAIN:-mycluster.example.com}"
K3S_VERSION="${K3S_VERSION:-v1.28.5+k3s1}"
METALLB_IP_RANGE="${METALLB_IP_RANGE:-192.168.1.240-192.168.1.250}"
NODE_TYPE="${NODE_TYPE:-master}" # master or agent
MASTER_IP="${MASTER_IP:-}" # Required for agent nodes
K3S_TOKEN="${K3S_TOKEN:-}" # Required for agent nodes

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}K3s Multi-Node Bootstrap Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

install_master() {
    echo -e "${YELLOW}Installing K3s Master Node...${NC}"

    # Install K3s as master with Traefik disabled (we'll use it separately)
    # Disable servicelb as we'll use MetalLB
    curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=${K3S_VERSION} sh -s - server \
        --disable=traefik \
        --disable=servicelb \
        --write-kubeconfig-mode=644 \
        --cluster-domain=${CLUSTER_DOMAIN} \
        --tls-san=${CLUSTER_DOMAIN}

    # Wait for K3s to be ready
    echo -e "${YELLOW}Waiting for K3s to be ready...${NC}"
    sleep 10

    # Get node token
    K3S_TOKEN=$(cat /var/lib/rancher/k3s/server/node-token)

    # Get master IP
    MASTER_IP=$(hostname -I | awk '{print $1}')

    echo -e "${GREEN}✓ K3s Master installed successfully!${NC}"
    echo -e "${GREEN}Master IP: ${MASTER_IP}${NC}"
    echo -e "${GREEN}Node Token: ${K3S_TOKEN}${NC}"
    echo -e "${YELLOW}Save these values to join agent nodes!${NC}"

    # Create kubeconfig for current user
    if [ -n "$SUDO_USER" ]; then
        USER_HOME=$(getent passwd $SUDO_USER | cut -d: -f6)
        mkdir -p ${USER_HOME}/.kube
        cp /etc/rancher/k3s/k3s.yaml ${USER_HOME}/.kube/config
        chown -R $SUDO_USER:$SUDO_USER ${USER_HOME}/.kube
        echo -e "${GREEN}✓ Kubeconfig copied to ${USER_HOME}/.kube/config${NC}"
    fi

    # Export kubeconfig
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

    echo -e "${YELLOW}Installing Helm...${NC}"
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

    echo -e "${GREEN}✓ Helm installed successfully!${NC}"
}

install_agent() {
    echo -e "${YELLOW}Installing K3s Agent Node...${NC}"

    if [ -z "$MASTER_IP" ]; then
        echo -e "${RED}MASTER_IP is required for agent installation${NC}"
        echo -e "${YELLOW}Usage: MASTER_IP=<ip> K3S_TOKEN=<token> ./k3s-bootstrap.sh${NC}"
        exit 1
    fi

    if [ -z "$K3S_TOKEN" ]; then
        echo -e "${RED}K3S_TOKEN is required for agent installation${NC}"
        echo -e "${YELLOW}Usage: MASTER_IP=<ip> K3S_TOKEN=<token> ./k3s-bootstrap.sh${NC}"
        exit 1
    fi

    curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=${K3S_VERSION} K3S_URL=https://${MASTER_IP}:6443 K3S_TOKEN=${K3S_TOKEN} sh -

    echo -e "${GREEN}✓ K3s Agent installed successfully!${NC}"
    echo -e "${GREEN}Joined to master at ${MASTER_IP}${NC}"
}

# Main installation logic
case $NODE_TYPE in
    master)
        install_master
        ;;
    agent)
        install_agent
        ;;
    *)
        echo -e "${RED}Invalid NODE_TYPE. Use 'master' or 'agent'${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation complete!${NC}"
echo -e "${GREEN}========================================${NC}"

if [ "$NODE_TYPE" = "master" ]; then
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "1. Install MetalLB: kubectl apply -f bootstrap/metallb-config.yaml"
    echo -e "2. Install Argo CD: kubectl apply -f bootstrap/argocd-install.yaml"
    echo -e "3. Bootstrap applications: kubectl apply -f bootstrap/app-of-apps.yaml"
    echo -e ""
    echo -e "Or simply run: ${GREEN}make bootstrap${NC}"
fi
