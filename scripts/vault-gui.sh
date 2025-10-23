#!/bin/bash
# Quick access to Vault GUI

export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml

echo "🔐 Opening Vault UI at http://localhost:8200"
echo ""
echo "Root token available in: infra/VAULT_CREDENTIALS.md"
echo ""
echo "Press Ctrl+C to stop"

kubectl port-forward -n vault svc/vault 8200:8200
