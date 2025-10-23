#!/bin/bash
# Quick access to Grafana GUI

export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml

echo "📊 Opening Grafana UI at http://localhost:3001"
echo ""
echo "Username: admin"
echo -n "Password: "
kubectl -n monitoring get secret grafana -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d
echo ""
echo ""
echo "Press Ctrl+C to stop"

kubectl port-forward -n monitoring svc/grafana 3001:80
