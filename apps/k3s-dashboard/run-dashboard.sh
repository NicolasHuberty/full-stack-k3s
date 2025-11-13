#!/bin/bash

# Set the kubeconfig path for K3s cluster
export KUBECONFIG=/Users/nicolas/Documents/k3s-app/kubeconfig.yml

# Verify connection
echo "Checking K3s cluster connection..."
kubectl cluster-info

echo ""
echo "Starting K3s dashboard on http://localhost:3000"
echo ""

# Start the Next.js development server
npm run dev
