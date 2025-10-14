.PHONY: help bootstrap install-k3s install-argocd install-vault init-vault install-metallb install-all status clean

# Colors for output
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
BLUE   := $(shell tput -Txterm setaf 4)
RED    := $(shell tput -Txterm setaf 1)
RESET  := $(shell tput -Txterm sgr0)

# Configuration
KUBECONFIG ?= ~/.kube/config
DOMAIN ?= mycluster.example.com

help: ## Show this help message
	@echo '$(BLUE)K3s GitOps Infrastructure$(RESET)'
	@echo ''
	@echo '$(GREEN)Usage:$(RESET)'
	@echo '  make $(YELLOW)<target>$(RESET)'
	@echo ''
	@echo '$(GREEN)Targets:$(RESET)'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

bootstrap: install-k3s install-metallb install-argocd install-vault init-vault ## Bootstrap the entire cluster (full setup)
	@echo '$(GREEN)✓ Cluster bootstrap complete!$(RESET)'
	@echo '$(YELLOW)Next steps:$(RESET)'
	@echo '  1. Configure your domain and Cloudflare credentials'
	@echo '  2. Run: make install-all'
	@echo '  3. Access Argo CD at: https://argocd.$(DOMAIN)'

install-k3s: ## Install K3s on the current node
	@echo '$(BLUE)Installing K3s...$(RESET)'
	@sudo bash bootstrap/k3s-bootstrap.sh
	@echo '$(GREEN)✓ K3s installed$(RESET)'

install-metallb: ## Install MetalLB load balancer
	@echo '$(BLUE)Installing MetalLB...$(RESET)'
	@kubectl apply -f bootstrap/metallb-config.yaml
	@kubectl wait --for=condition=ready pod -l app=metallb -n metallb-system --timeout=300s
	@echo '$(GREEN)✓ MetalLB installed$(RESET)'

install-argocd: ## Install Argo CD
	@echo '$(BLUE)Installing Argo CD...$(RESET)'
	@kubectl create namespace argocd || true
	@kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
	@kubectl apply -f bootstrap/argocd-install.yaml
	@kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
	@echo '$(GREEN)✓ Argo CD installed$(RESET)'
	@echo '$(YELLOW)Get the initial admin password with:$(RESET)'
	@echo '  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d'

install-vault: ## Install Vault
	@echo '$(BLUE)Installing Vault...$(RESET)'
	@kubectl create namespace vault || true
	@kubectl apply -f apps/argocd/vault-app.yaml
	@kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=vault -n vault --timeout=300s
	@echo '$(GREEN)✓ Vault installed$(RESET)'

init-vault: ## Initialize and unseal Vault
	@echo '$(BLUE)Initializing Vault...$(RESET)'
	@bash apps/vault/vault-init.sh
	@echo '$(GREEN)✓ Vault initialized$(RESET)'

install-all: ## Install all applications via Argo CD (after bootstrap)
	@echo '$(BLUE)Deploying all applications via Argo CD...$(RESET)'
	@kubectl apply -f manifests/namespaces/namespaces.yaml
	@kubectl apply -f manifests/issuers/cluster-issuer.yaml
	@kubectl apply -f apps/cert-manager/cloudflare-secret.yaml
	@kubectl apply -f apps/external-dns/cloudflare-secret.yaml
	@kubectl apply -f bootstrap/app-of-apps.yaml
	@echo '$(GREEN)✓ All applications deployed$(RESET)'
	@echo '$(YELLOW)Monitor deployment status with:$(RESET)'
	@echo '  watch kubectl get applications -n argocd'

status: ## Show cluster status
	@echo '$(BLUE)Cluster Status$(RESET)'
	@echo ''
	@echo '$(GREEN)Nodes:$(RESET)'
	@kubectl get nodes
	@echo ''
	@echo '$(GREEN)Namespaces:$(RESET)'
	@kubectl get namespaces
	@echo ''
	@echo '$(GREEN)Argo CD Applications:$(RESET)'
	@kubectl get applications -n argocd 2>/dev/null || echo 'Argo CD not installed'
	@echo ''
	@echo '$(GREEN)Pods Status by Namespace:$(RESET)'
	@kubectl get pods --all-namespaces

sync-argocd: ## Sync all Argo CD applications
	@echo '$(BLUE)Syncing all Argo CD applications...$(RESET)'
	@kubectl get applications -n argocd -o name | xargs -I {} kubectl patch {} -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
	@echo '$(GREEN)✓ All applications synced$(RESET)'

get-passwords: ## Get admin passwords for all services
	@echo '$(BLUE)Admin Passwords$(RESET)'
	@echo ''
	@echo '$(GREEN)Argo CD:$(RESET)'
	@kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>/dev/null | base64 -d && echo || echo 'Not available'
	@echo ''
	@echo '$(GREEN)Grafana:$(RESET)'
	@kubectl -n monitoring get secret kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" 2>/dev/null | base64 -d && echo || echo 'Not available'
	@echo ''
	@echo '$(GREEN)Vault Root Token:$(RESET)'
	@echo 'Check vault-keys.json file'

get-urls: ## Get access URLs for all services
	@echo '$(BLUE)Service URLs$(RESET)'
	@echo ''
	@echo '$(GREEN)Argo CD:$(RESET)      https://argocd.$(DOMAIN)'
	@echo '$(GREEN)Grafana:$(RESET)      https://grafana.$(DOMAIN)'
	@echo '$(GREEN)Vault:$(RESET)        https://vault.$(DOMAIN)'
	@echo '$(GREEN)Rancher:$(RESET)      https://rancher.$(DOMAIN)'
	@echo '$(GREEN)Demo App:$(RESET)     https://demo.$(DOMAIN)'

lint: ## Lint YAML files
	@echo '$(BLUE)Linting YAML files...$(RESET)'
	@yamllint -c .yamllint.yaml . || echo '$(YELLOW)yamllint not installed, skipping...$(RESET)'

validate: ## Validate Kubernetes manifests
	@echo '$(BLUE)Validating Kubernetes manifests...$(RESET)'
	@find . -name '*.yaml' -type f | xargs kubeconform -strict -ignore-missing-schemas || echo '$(YELLOW)kubeconform not installed, skipping...$(RESET)'

test: lint validate ## Run all tests (lint + validate)
	@echo '$(GREEN)✓ All tests passed$(RESET)'

clean: ## Clean up the cluster (WARNING: destructive!)
	@echo '$(RED)This will delete all resources. Are you sure? [y/N]$(RESET)' && read ans && [ $${ans:-N} = y ]
	@kubectl delete -f bootstrap/app-of-apps.yaml || true
	@kubectl delete namespace argocd vault monitoring cert-manager external-dns external-secrets cattle-system demo-app || true
	@echo '$(YELLOW)✓ Cluster cleaned$(RESET)'

uninstall-k3s: ## Uninstall K3s completely
	@echo '$(RED)This will uninstall K3s completely. Are you sure? [y/N]$(RESET)' && read ans && [ $${ans:-N} = y ]
	@sudo /usr/local/bin/k3s-uninstall.sh || echo 'K3s not installed'
	@echo '$(YELLOW)✓ K3s uninstalled$(RESET)'

logs-argocd: ## Show Argo CD server logs
	@kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server --tail=100 -f

logs-vault: ## Show Vault logs
	@kubectl logs -n vault -l app.kubernetes.io/name=vault --tail=100 -f

port-forward-argocd: ## Port-forward to Argo CD UI (localhost:8080)
	@echo '$(BLUE)Access Argo CD at: http://localhost:8080$(RESET)'
	@kubectl port-forward svc/argocd-server -n argocd 8080:443

port-forward-grafana: ## Port-forward to Grafana UI (localhost:3000)
	@echo '$(BLUE)Access Grafana at: http://localhost:3000$(RESET)'
	@kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3000:80

port-forward-vault: ## Port-forward to Vault UI (localhost:8200)
	@echo '$(BLUE)Access Vault at: http://localhost:8200$(RESET)'
	@kubectl port-forward svc/vault -n vault 8200:8200

backup-vault: ## Backup Vault data
	@echo '$(BLUE)Backing up Vault data...$(RESET)'
	@kubectl exec -n vault vault-0 -- vault operator raft snapshot save /tmp/vault-backup.snap
	@kubectl cp vault/vault-0:/tmp/vault-backup.snap ./vault-backup-$(shell date +%Y%m%d-%H%M%S).snap
	@echo '$(GREEN)✓ Vault backup created$(RESET)'

.DEFAULT_GOAL := help
