# Quick Start Guide

This guide will get your K3s GitOps infrastructure up and running in under 30 minutes.

## Prerequisites Checklist

- [ ] Linux servers (1 master + 2+ agents recommended)
- [ ] Root/sudo access on all nodes
- [ ] Cloudflare account with a domain
- [ ] Cloudflare API token with DNS edit permissions
- [ ] Internet connectivity

## Step-by-Step Setup

### 1. Prepare Configuration (5 minutes)

```bash
# Clone the repository
git clone <your-repo-url>
cd infra

# Copy and edit configuration
cp bootstrap/config.env bootstrap/config.local.env
nano bootstrap/config.local.env
```

**Required changes in config.local.env:**
```bash
export CLUSTER_DOMAIN="yourdomain.com"           # Your actual domain
export METALLB_IP_RANGE="192.168.1.240-192.168.1.250"  # Your IP range
export CLOUDFLARE_EMAIL="your-email@example.com"
export CLOUDFLARE_API_TOKEN="your-token-here"
export ACME_EMAIL="your-email@example.com"
```

### 2. Install K3s Master (5 minutes)

On your **master node**:

```bash
cd infra
source bootstrap/config.local.env

# Install K3s master
export NODE_TYPE="master"
sudo bash bootstrap/k3s-bootstrap.sh

# Save the output!
# You'll need K3S_TOKEN and MASTER_IP for agent nodes
```

### 3. Install K3s Agents (5 minutes)

On **each agent node**:

```bash
cd infra

# Use values from master node
export NODE_TYPE="agent"
export MASTER_IP="<ip-from-master>"
export K3S_TOKEN="<token-from-master>"

sudo bash bootstrap/k3s-bootstrap.sh
```

### 4. Bootstrap Core Services (10 minutes)

Back on the **master node**:

```bash
cd infra

# This installs MetalLB, Argo CD, and Vault
make bootstrap

# Get Argo CD admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### 5. Configure Secrets (3 minutes)

```bash
# Create Cloudflare secrets
kubectl create secret generic cloudflare-api-token \
  --from-literal=api-token="YOUR_CLOUDFLARE_TOKEN" \
  -n cert-manager

kubectl create secret generic cloudflare-api-token \
  --from-literal=api-token="YOUR_CLOUDFLARE_TOKEN" \
  -n external-dns
```

### 6. Deploy All Applications (5 minutes)

```bash
# Deploy everything via GitOps
make install-all

# Monitor deployment
watch kubectl get applications -n argocd
```

Wait until all applications show "Healthy" and "Synced".

### 7. Verify Installation (2 minutes)

```bash
# Check cluster status
make status

# Get all admin passwords
make get-passwords

# Get all service URLs
make get-urls
```

## Access Your Services

After DNS propagates (5-10 minutes):

1. **Argo CD**: https://argocd.yourdomain.com
   - Username: `admin`
   - Password: (from step 4)

2. **Grafana**: https://grafana.yourdomain.com
   - Username: `admin`
   - Password: (from `make get-passwords`)

3. **Vault**: https://vault.yourdomain.com
   - Token: (check `vault-keys.json`)

4. **Rancher**: https://rancher.yourdomain.com
   - Password: `admin` (change immediately!)

5. **Demo App**: https://demo.yourdomain.com

## Troubleshooting

### DNS Not Resolving

```bash
# Check ExternalDNS logs
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns

# Verify Cloudflare secret
kubectl get secret cloudflare-api-token -n external-dns -o yaml
```

### Certificates Not Issuing

```bash
# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager

# Check certificate status
kubectl get certificates -A
kubectl describe certificate <cert-name> -n <namespace>
```

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -A | grep -v Running

# Describe problematic pod
kubectl describe pod <pod-name> -n <namespace>

# Check logs
kubectl logs <pod-name> -n <namespace>
```

### Argo CD Applications Not Syncing

```bash
# Check application status
kubectl get applications -n argocd

# Force sync
kubectl patch application <app-name> -n argocd \
  --type merge \
  -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
```

## Next Steps

1. **Secure Your Cluster**:
   - Change all default passwords
   - Configure proper RBAC
   - Enable network policies

2. **Configure Monitoring**:
   - Access Grafana
   - Review pre-installed dashboards
   - Set up alerts

3. **Deploy Your Applications**:
   - Create Application manifests in `apps/argocd/`
   - Commit to Git
   - Watch Argo CD auto-deploy

4. **Set Up CI/CD**:
   - Configure GitHub Actions secrets
   - Push changes to trigger builds
   - Watch automated deployments

## Useful Commands

```bash
# Quick cluster status
make status

# Get all passwords
make get-passwords

# Port-forward to services (if DNS not ready)
make port-forward-argocd    # localhost:8080
make port-forward-grafana   # localhost:3000
make port-forward-vault     # localhost:8200

# View logs
make logs-argocd
make logs-vault

# Sync all Argo CD applications
make sync-argocd

# Backup Vault
make backup-vault
```

## Getting Help

- Check the main [README.md](README.md) for detailed documentation
- Review the troubleshooting section
- Check application logs
- Verify all secrets are created correctly

---

**Congratulations!** Your K3s GitOps infrastructure is now running! 🎉
