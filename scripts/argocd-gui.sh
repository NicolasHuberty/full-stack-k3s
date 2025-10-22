#!/bin/bash
# Quick access to ArgoCD GUI

export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml

echo "🚀 Opening ArgoCD UI at http://localhost:8080"
echo ""
echo "Username: admin"
echo -n "Password: "
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>/dev/null | base64 -d
echo ""
echo ""
echo "Press Ctrl+C to stop"

kubectl port-forward -n argocd svc/argocd-server 8080:80
