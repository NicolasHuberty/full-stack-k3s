#!/bin/bash
#
# Vault Initialization Script
# This script initializes and unseals Vault, then configures Kubernetes auth
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Vault Initialization Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Get Vault pod name
VAULT_POD=$(kubectl get pods -n vault -l app.kubernetes.io/name=vault -o jsonpath='{.items[0].metadata.name}')

if [ -z "$VAULT_POD" ]; then
    echo -e "${RED}Error: Vault pod not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Vault pod: ${VAULT_POD}${NC}"

# Check if Vault is already initialized
INIT_STATUS=$(kubectl exec -n vault $VAULT_POD -- vault status -format=json 2>/dev/null | jq -r '.initialized' || echo "false")

if [ "$INIT_STATUS" == "true" ]; then
    echo -e "${YELLOW}Vault is already initialized${NC}"
    echo -e "${YELLOW}If you need to unseal, use the unseal keys from vault-keys.json${NC}"
else
    echo -e "${YELLOW}Initializing Vault...${NC}"

    # Initialize Vault with 5 key shares and 3 key threshold
    INIT_OUTPUT=$(kubectl exec -n vault $VAULT_POD -- vault operator init -key-shares=5 -key-threshold=3 -format=json)

    echo "$INIT_OUTPUT" > vault-keys.json

    echo -e "${GREEN}✓ Vault initialized successfully!${NC}"
    echo -e "${RED}IMPORTANT: Save the vault-keys.json file in a secure location!${NC}"
    echo -e "${RED}You will need these keys to unseal Vault${NC}"

    # Extract unseal keys
    UNSEAL_KEY_1=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[0]')
    UNSEAL_KEY_2=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[1]')
    UNSEAL_KEY_3=$(echo "$INIT_OUTPUT" | jq -r '.unseal_keys_b64[2]')
    ROOT_TOKEN=$(echo "$INIT_OUTPUT" | jq -r '.root_token')

    echo -e "${YELLOW}Unsealing Vault...${NC}"

    # Unseal Vault (need 3 out of 5 keys)
    kubectl exec -n vault $VAULT_POD -- vault operator unseal "$UNSEAL_KEY_1"
    kubectl exec -n vault $VAULT_POD -- vault operator unseal "$UNSEAL_KEY_2"
    kubectl exec -n vault $VAULT_POD -- vault operator unseal "$UNSEAL_KEY_3"

    echo -e "${GREEN}✓ Vault unsealed successfully!${NC}"

    # Login with root token
    kubectl exec -n vault $VAULT_POD -- vault login "$ROOT_TOKEN"

    echo -e "${YELLOW}Configuring Kubernetes authentication...${NC}"

    # Enable Kubernetes auth
    kubectl exec -n vault $VAULT_POD -- vault auth enable kubernetes

    # Configure Kubernetes auth
    kubectl exec -n vault $VAULT_POD -- sh -c 'vault write auth/kubernetes/config \
        kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443" \
        kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
        token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token'

    echo -e "${GREEN}✓ Kubernetes authentication configured!${NC}"

    # Enable KV secrets engine
    kubectl exec -n vault $VAULT_POD -- vault secrets enable -path=secret kv-v2

    echo -e "${GREEN}✓ KV secrets engine enabled!${NC}"

    # Create a sample secret
    kubectl exec -n vault $VAULT_POD -- vault kv put secret/demo-app/config \
        database_url="postgresql://localhost:5432/mydb" \
        api_key="sample-api-key-12345"

    echo -e "${GREEN}✓ Sample secret created at secret/demo-app/config${NC}"

    # Create a policy for demo-app
    kubectl exec -n vault $VAULT_POD -- vault policy write demo-app - <<EOF
path "secret/data/demo-app/*" {
  capabilities = ["read", "list"]
}
EOF

    echo -e "${GREEN}✓ Policy 'demo-app' created!${NC}"

    # Create a Kubernetes role for demo-app
    kubectl exec -n vault $VAULT_POD -- vault write auth/kubernetes/role/demo-app \
        bound_service_account_names=demo-app \
        bound_service_account_namespaces=demo-app \
        policies=demo-app \
        ttl=24h

    echo -e "${GREEN}✓ Kubernetes role 'demo-app' created!${NC}"

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Vault setup complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${YELLOW}Root token: ${ROOT_TOKEN}${NC}"
    echo -e "${RED}Save this token in a secure location!${NC}"
fi
