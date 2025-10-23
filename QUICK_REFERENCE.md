# Docuralis Quick Reference

Essential commands for managing the Docuralis deployment.

## Quick Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Dev | https://dev.huberty.pro | Development environment |
| Staging | https://staging.huberty.pro | Staging environment |
| Production | https://app.huberty.pro | Production environment |
| ArgoCD | https://argocd.huberty.pro | GitOps deployment |
| Vault | https://vault.huberty.pro | Secrets management |
| Grafana | https://grafana.huberty.pro | Monitoring |
| MinIO | https://minio.huberty.pro | Object storage |

## Essential Commands

### Vault Commands

```bash
# Login to Vault
export VAULT_ADDR='https://vault.huberty.pro'
vault login

# List secrets
vault kv list secret/docuralis
vault kv list secret/infrastructure

# Get specific secret
vault kv get secret/docuralis/production
vault kv get secret/infrastructure/minio

# Update secret
vault kv put secret/docuralis/production \
  database_url="new-value" \
  nextauth_secret="new-value"
```

### Kubernetes Commands

```bash
# Get pods
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n production

# Get pod logs
kubectl logs -n dev -l app=docuralis --tail=100 -f
kubectl logs -n staging -l app=docuralis --tail=100 -f
kubectl logs -n production -l app=docuralis --tail=100 -f

# Get specific pod logs
kubectl logs -n dev <pod-name> --tail=100 -f

# Describe pod
kubectl describe pod <pod-name> -n dev

# Exec into pod
kubectl exec -it -n dev deployment/dev-docuralis -- sh

# Get deployments
kubectl get deployments -n dev
kubectl get deployments -n staging
kubectl get deployments -n production

# Scale deployment
kubectl scale deployment/dev-docuralis --replicas=2 -n dev
kubectl scale deployment/staging-docuralis --replicas=3 -n staging
kubectl scale deployment/prod-docuralis --replicas=5 -n production

# Restart deployment
kubectl rollout restart deployment/dev-docuralis -n dev
kubectl rollout restart deployment/staging-docuralis -n staging
kubectl rollout restart deployment/prod-docuralis -n production

# Check rollout status
kubectl rollout status deployment/dev-docuralis -n dev

# Rollback deployment
kubectl rollout undo deployment/prod-docuralis -n production
kubectl rollout history deployment/prod-docuralis -n production
```

### Secrets and ConfigMaps

```bash
# Get secrets
kubectl get secrets -n dev
kubectl get secret docuralis-secrets -n dev
kubectl describe secret docuralis-secrets -n dev

# Get ExternalSecrets
kubectl get externalsecrets -n dev
kubectl describe externalsecret docuralis-secrets -n dev

# Check External Secrets Operator
kubectl logs -n external-secrets -l app.kubernetes.io/name=external-secrets --tail=100 -f
```

### Ingress and Networking

```bash
# Get ingress
kubectl get ingress -n dev
kubectl get ingress -n staging
kubectl get ingress -n production

# Describe ingress
kubectl describe ingress docuralis-ingress -n dev

# Get services
kubectl get svc -n dev
kubectl get svc -n staging
kubectl get svc -n production

# Test service connectivity (from within cluster)
kubectl run -it --rm debug --image=busybox --restart=Never -- sh
# Inside the pod:
wget -O- http://dev-docuralis.dev:3000/api/health
```

### Certificates

```bash
# Get certificates
kubectl get certificates -n dev
kubectl get certificates -n staging
kubectl get certificates -n production

# Describe certificate
kubectl describe certificate docuralis-dev-tls -n dev

# Get certificate requests
kubectl get certificaterequest -n dev
kubectl describe certificaterequest <name> -n dev

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=100 -f
```

### ArgoCD Commands

```bash
# Login to ArgoCD
argocd login argocd.huberty.pro

# List applications
argocd app list

# Get application details
argocd app get docuralis-dev
argocd app get docuralis-staging
argocd app get docuralis-production

# Sync application
argocd app sync docuralis-dev
argocd app sync docuralis-staging
argocd app sync docuralis-production

# Force sync (skip hooks)
argocd app sync docuralis-dev --force

# Refresh application (check for changes)
argocd app get docuralis-dev --refresh

# View application history
argocd app history docuralis-production

# Rollback application
argocd app rollback docuralis-production <revision-number>

# Watch application sync
argocd app wait docuralis-dev --sync

# Delete application (careful!)
argocd app delete docuralis-dev --cascade=false
```

### Database Commands

```bash
# Connect to PostgreSQL
kubectl exec -it -n database deployment/postgresql -- psql -U rag_admin -d docuralis

# Inside PostgreSQL:
\l                          # List databases
\c docuralis                # Connect to database
\dt                         # List tables
\d User                     # Describe table
SELECT * FROM "User" LIMIT 10;  # Query table
\q                          # Quit

# Run migrations from pod
kubectl exec -it -n dev deployment/dev-docuralis -- npx prisma migrate deploy
kubectl exec -it -n staging deployment/staging-docuralis -- npx prisma migrate deploy
kubectl exec -it -n production deployment/prod-docuralis -- npx prisma migrate deploy

# Generate Prisma client
kubectl exec -it -n dev deployment/dev-docuralis -- npx prisma generate

# Check database connection from pod
kubectl exec -it -n dev deployment/dev-docuralis -- sh -c 'nc -zv postgresql.database 5432'
```

### MinIO Commands

```bash
# Access MinIO console
open https://minio.huberty.pro

# Or use mc (MinIO Client) - install first
mc alias set myminio https://minio.huberty.pro minioadmin minioadmin123
mc ls myminio
mc mb myminio/docuralis
mc ls myminio/docuralis
```

### Monitoring Commands

```bash
# Get all pods in all namespaces
kubectl get pods --all-namespaces

# Get resource usage
kubectl top nodes
kubectl top pods -n production

# Get events
kubectl get events -n dev --sort-by='.lastTimestamp'

# Describe namespace
kubectl describe namespace dev

# Get all resources in namespace
kubectl get all -n dev
```

### GitHub Actions

```bash
# Trigger workflow manually (via GitHub CLI)
gh workflow run docuralis.yml --ref dev

# List workflow runs
gh run list --workflow=docuralis.yml

# View workflow run
gh run view <run-id>

# View workflow logs
gh run view <run-id> --log
```

## Troubleshooting Quick Checks

### Pod Not Starting

```bash
# Check pod status
kubectl get pods -n dev

# Check pod events
kubectl describe pod <pod-name> -n dev

# Check pod logs
kubectl logs <pod-name> -n dev

# Check previous container logs (if crashed)
kubectl logs <pod-name> -n dev --previous
```

### Image Pull Issues

```bash
# Check image pull secret
kubectl get secret ghcr-credentials -n dev
kubectl describe secret ghcr-credentials -n dev

# Check if image exists
docker pull ghcr.io/nicolashuberty/k3s-app/docuralis:dev

# Recreate image pull secret
kubectl delete secret ghcr-credentials -n dev
kubectl create secret docker-registry ghcr-credentials \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN \
  --docker-email=your-email@example.com \
  --namespace=dev
```

### Secret Not Available

```bash
# Check ExternalSecret status
kubectl get externalsecrets -n dev
kubectl describe externalsecret docuralis-secrets -n dev

# Check External Secrets Operator logs
kubectl logs -n external-secrets -l app.kubernetes.io/name=external-secrets --tail=100

# Check if secret was created
kubectl get secret docuralis-secrets -n dev

# Manually trigger sync (delete and recreate ExternalSecret)
kubectl delete externalsecret docuralis-secrets -n dev
kubectl apply -f infra/apps/docuralis/external-secrets.yaml
```

### Certificate Issues

```bash
# Check certificate status
kubectl get certificate docuralis-dev-tls -n dev

# Check certificate request
kubectl get certificaterequest -n dev
kubectl describe certificaterequest <name> -n dev

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=100

# Delete and recreate certificate (will auto-regenerate)
kubectl delete certificate docuralis-dev-tls -n dev
# ArgoCD will recreate it
```

### DNS Not Resolving

```bash
# Check DNS record
dig dev.huberty.pro

# Check ExternalDNS logs
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns --tail=100

# Check ingress annotation
kubectl get ingress docuralis-ingress -n dev -o yaml | grep external-dns

# Verify Cloudflare API token
kubectl get secret cloudflare-api-token -n external-dns
```

### ArgoCD Not Syncing

```bash
# Check ArgoCD application status
argocd app get docuralis-dev

# Check ArgoCD application controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller --tail=100

# Force refresh
argocd app get docuralis-dev --refresh --hard-refresh

# Check if repo is accessible
argocd repo list

# Re-add repo if needed
argocd repo add https://github.com/NicolasHuberty/full-stack-k3s.git
```

## Health Checks

```bash
# HTTP health checks
curl https://dev.huberty.pro/api/health
curl https://staging.huberty.pro/api/health
curl https://app.huberty.pro/api/health

# From within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://dev-docuralis.dev:3000/api/health

# Check all services
for env in dev staging production; do
  echo "=== $env ==="
  curl -s https://$env.huberty.pro/api/health | jq
done
```

## Emergency Procedures

### Restart Everything

```bash
# Restart deployments
kubectl rollout restart deployment/dev-docuralis -n dev
kubectl rollout restart deployment/staging-docuralis -n staging
kubectl rollout restart deployment/prod-docuralis -n production

# Wait for rollout
kubectl rollout status deployment/dev-docuralis -n dev
```

### Scale Down (Emergency Stop)

```bash
kubectl scale deployment/dev-docuralis --replicas=0 -n dev
kubectl scale deployment/staging-docuralis --replicas=0 -n staging
kubectl scale deployment/prod-docuralis --replicas=0 -n production
```

### Scale Up

```bash
kubectl scale deployment/dev-docuralis --replicas=1 -n dev
kubectl scale deployment/staging-docuralis --replicas=2 -n staging
kubectl scale deployment/prod-docuralis --replicas=3 -n production
```

### Force Sync All Environments

```bash
argocd app sync docuralis-dev --force
argocd app sync docuralis-staging --force
argocd app sync docuralis-production --force
```

## Useful Aliases

Add these to your `~/.bashrc` or `~/.zshrc`:

```bash
# Kubectl aliases
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgd='kubectl get deployments'
alias kgs='kubectl get services'
alias kgi='kubectl get ingress'
alias kl='kubectl logs -f --tail=100'
alias kx='kubectl exec -it'
alias kd='kubectl describe'

# Environment-specific
alias kdev='kubectl -n dev'
alias kstg='kubectl -n staging'
alias kprd='kubectl -n production'

# ArgoCD aliases
alias async='argocd app sync'
alias aget='argocd app get'
alias alist='argocd app list'

# Docuralis-specific
alias doclogs='kubectl logs -n production -l app=docuralis -f --tail=100'
alias docpods='kubectl get pods -n production -l app=docuralis'
alias docrestart='kubectl rollout restart deployment/prod-docuralis -n production'
```

## Monitoring Dashboard URLs

- **ArgoCD Applications**: https://argocd.huberty.pro/applications
- **Grafana Dashboards**: https://grafana.huberty.pro/dashboards
- **Vault UI**: https://vault.huberty.pro/ui/vault/secrets
- **MinIO Console**: https://minio.huberty.pro

## Support Contacts

- **DevOps Team**: devops@example.com
- **On-Call**: +1-XXX-XXX-XXXX
- **Slack**: #docuralis-deployments

---

**Keep this document handy for quick reference during deployments and troubleshooting!**
