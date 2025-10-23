# Docuralis Deployment Checklist

Use this checklist to ensure all steps are completed for a successful Docuralis deployment.

## Pre-Deployment Checklist

### Infrastructure Verification
- [ ] K3s cluster is running and accessible
- [ ] ArgoCD is installed and accessible at https://argocd.huberty.pro
- [ ] Vault is installed, unsealed, and accessible at https://vault.huberty.pro
- [ ] External Secrets Operator is installed
- [ ] cert-manager is installed and configured
- [ ] ExternalDNS is configured with Cloudflare
- [ ] PostgreSQL is deployed in `database` namespace
- [ ] MinIO is deployed in `storage` namespace
- [ ] Qdrant is deployed in `database` namespace
- [ ] Traefik is configured as ingress controller

### Access Verification
- [ ] Have Vault root token from `VAULT_CREDENTIALS.md`
- [ ] Can access Vault CLI: `vault status`
- [ ] Can access kubectl: `kubectl get nodes`
- [ ] Can access ArgoCD CLI: `argocd version`
- [ ] Have GitHub Personal Access Token for GHCR

## Step 1: Vault Secret Setup

### Infrastructure Secrets
- [ ] Login to Vault: `export VAULT_ADDR='https://vault.huberty.pro' && vault login`
- [ ] Create PostgreSQL secrets: `vault kv put secret/infrastructure/postgresql ...`
- [ ] Create MinIO secrets: `vault kv put secret/infrastructure/minio ...`
- [ ] Create Qdrant secrets: `vault kv put secret/infrastructure/qdrant ...`
- [ ] Verify infrastructure secrets: `vault kv list secret/infrastructure`

### Docuralis Environment Secrets
- [ ] Create dev secrets: `vault kv put secret/docuralis/dev ...`
- [ ] Create staging secrets: `vault kv put secret/docuralis/staging ...`
- [ ] Create production secrets: `vault kv put secret/docuralis/production ...`
- [ ] Verify environment secrets: `vault kv list secret/docuralis`

### OAuth Provider Secrets
- [ ] Set up Google OAuth application
- [ ] Set up GitHub OAuth application
- [ ] Set up Azure AD OAuth application
- [ ] Create OAuth secrets in Vault: `vault kv put secret/docuralis/oauth ...`
- [ ] Verify OAuth secrets: `vault kv get secret/docuralis/oauth`

### API Keys
- [ ] Get OpenAI API key
- [ ] Create API key secrets: `vault kv put secret/docuralis/api-keys ...`
- [ ] Verify API keys: `vault kv get secret/docuralis/api-keys`

### SMTP Configuration (Optional)
- [ ] Set up SMTP credentials
- [ ] Create SMTP secrets: `vault kv put secret/docuralis/smtp ...`
- [ ] Verify SMTP secrets: `vault kv get secret/docuralis/smtp`

## Step 2: Kubernetes Setup

### Namespaces
- [ ] Create dev namespace: `kubectl create namespace dev`
- [ ] Create staging namespace: `kubectl create namespace staging`
- [ ] Create production namespace: `kubectl create namespace production`
- [ ] Verify namespaces: `kubectl get namespaces`

### ExternalSecrets
- [ ] Apply ExternalSecrets: `kubectl apply -f infra/apps/docuralis/external-secrets.yaml`
- [ ] Wait for sync (1-2 minutes)
- [ ] Verify dev ExternalSecret: `kubectl get externalsecrets -n dev`
- [ ] Verify staging ExternalSecret: `kubectl get externalsecrets -n staging`
- [ ] Verify production ExternalSecret: `kubectl get externalsecrets -n production`
- [ ] Check dev secret created: `kubectl get secret docuralis-secrets -n dev`
- [ ] Check staging secret created: `kubectl get secret docuralis-secrets -n staging`
- [ ] Check production secret created: `kubectl get secret docuralis-secrets -n production`

### Image Pull Secrets
- [ ] Create dev image pull secret
- [ ] Create staging image pull secret
- [ ] Create production image pull secret
- [ ] Verify secrets: `kubectl get secrets -n dev | grep ghcr-credentials`

```bash
# Create image pull secrets
for ns in dev staging production; do
  kubectl create secret docker-registry ghcr-credentials \
    --docker-server=ghcr.io \
    --docker-username=YOUR_GITHUB_USERNAME \
    --docker-password=YOUR_GITHUB_TOKEN \
    --docker-email=your-email@example.com \
    --namespace=$ns \
    --dry-run=client -o yaml | kubectl apply -f -
done
```

## Step 3: Database Setup

### Create Databases
- [ ] Connect to PostgreSQL: `kubectl exec -it -n database deployment/postgresql -- psql -U rag_admin -d postgres`
- [ ] Create dev database: `CREATE DATABASE docuralis_dev;`
- [ ] Create staging database: `CREATE DATABASE docuralis_staging;`
- [ ] Create production database: `CREATE DATABASE docuralis;`
- [ ] Enable pgvector on dev: `\c docuralis_dev; CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Enable pgvector on staging: `\c docuralis_staging; CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Enable pgvector on production: `\c docuralis; CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Verify databases: `\l` (list databases)

### MinIO Buckets (Optional - will be created by app)
- [ ] Access MinIO console: https://minio.huberty.pro
- [ ] Create `docuralis` bucket (or let app create it)
- [ ] Set bucket policy to private

## Step 4: Git and GitHub

### Code Preparation
- [ ] Review all changes in the repository
- [ ] Ensure Dockerfile exists in `apps/docuralis/`
- [ ] Ensure next.config.ts has `output: 'standalone'`
- [ ] Ensure health API route exists at `src/app/api/health/route.ts`

### GitHub Actions
- [ ] Verify workflow file exists: `.github/workflows/docuralis.yml`
- [ ] Check GitHub Actions permissions: Settings → Actions → General → Workflow permissions
- [ ] Enable "Read and write permissions" for GITHUB_TOKEN
- [ ] Verify GHCR package visibility (public or configure credentials)

### Branch Setup
- [ ] Commit all changes to dev branch
- [ ] Push dev branch: `git push origin dev`
- [ ] Watch GitHub Actions build: Check Actions tab
- [ ] Verify image published to GHCR: https://github.com/NicolasHuberty?tab=packages

### Merge to Staging
- [ ] Create staging branch if needed: `git checkout -b staging`
- [ ] Merge dev to staging: `git merge dev`
- [ ] Push staging: `git push origin staging`
- [ ] Wait for GitHub Actions to build staging image

### Merge to Production (after testing)
- [ ] Test staging thoroughly
- [ ] Merge staging to main: `git checkout main && git merge staging`
- [ ] Push main: `git push origin main`
- [ ] Wait for GitHub Actions to build production image

## Step 5: ArgoCD Deployment

### Apply ArgoCD Applications
- [ ] Apply app-of-apps: `kubectl apply -f infra/argocd/app-of-apps.yaml`
- [ ] Wait for applications to appear (30 seconds)
- [ ] Verify applications created: `kubectl get applications -n argocd`
- [ ] Check ArgoCD UI: https://argocd.huberty.pro

### Sync Dev Environment
- [ ] Sync dev app: `argocd app sync docuralis-dev` (or use UI)
- [ ] Wait for sync to complete
- [ ] Check pod status: `kubectl get pods -n dev`
- [ ] Wait for pod to be Running (may take 2-3 minutes for image pull)
- [ ] Check logs: `kubectl logs -n dev -l app=docuralis --tail=50`

### Sync Staging Environment
- [ ] Sync staging app: `argocd app sync docuralis-staging`
- [ ] Wait for sync to complete
- [ ] Check pod status: `kubectl get pods -n staging`
- [ ] Check logs: `kubectl logs -n staging -l app=docuralis --tail=50`

### Sync Production Environment
- [ ] Review changes in ArgoCD UI first
- [ ] Sync production app: `argocd app sync docuralis-production`
- [ ] Monitor deployment carefully
- [ ] Check pod status: `kubectl get pods -n production`
- [ ] Check logs: `kubectl logs -n production -l app=docuralis --tail=50`

## Step 6: Database Migrations

### Run Migrations
- [ ] Dev migrations: `kubectl exec -it -n dev deployment/dev-docuralis -- npx prisma migrate deploy`
- [ ] Staging migrations: `kubectl exec -it -n staging deployment/staging-docuralis -- npx prisma migrate deploy`
- [ ] Production migrations: `kubectl exec -it -n production deployment/prod-docuralis -- npx prisma migrate deploy`
- [ ] Verify migrations succeeded (check command output)

### Seed Data (Optional)
- [ ] Seed dev database if needed
- [ ] Verify seed data

## Step 7: DNS and TLS Verification

### DNS Records
- [ ] Check dev DNS: `dig dev.huberty.pro`
- [ ] Check staging DNS: `dig staging.huberty.pro`
- [ ] Check production DNS: `dig app.huberty.pro`
- [ ] Verify all DNS records point to correct IP
- [ ] Wait for DNS propagation (up to 5 minutes)

### TLS Certificates
- [ ] Check dev certificate: `kubectl get certificate docuralis-dev-tls -n dev`
- [ ] Check staging certificate: `kubectl get certificate docuralis-staging-tls -n staging`
- [ ] Check production certificate: `kubectl get certificate docuralis-prod-tls -n production`
- [ ] Verify certificates are Ready (may take 2-3 minutes)
- [ ] Check certificate details: `kubectl describe certificate docuralis-dev-tls -n dev`

### Ingress Verification
- [ ] Check dev ingress: `kubectl get ingress -n dev`
- [ ] Check staging ingress: `kubectl get ingress -n staging`
- [ ] Check production ingress: `kubectl get ingress -n production`
- [ ] Verify ingress has ADDRESS assigned

## Step 8: Application Testing

### Health Checks
- [ ] Test dev health: `curl https://dev.huberty.pro/api/health`
- [ ] Test staging health: `curl https://staging.huberty.pro/api/health`
- [ ] Test production health: `curl https://app.huberty.pro/api/health`
- [ ] Verify all return 200 OK with JSON response

### Browser Testing
- [ ] Open dev in browser: https://dev.huberty.pro
- [ ] Open staging in browser: https://staging.huberty.pro
- [ ] Open production in browser: https://app.huberty.pro
- [ ] Verify pages load correctly
- [ ] Check browser console for errors

### Authentication Testing
- [ ] Test Google OAuth login (dev)
- [ ] Test GitHub OAuth login (dev)
- [ ] Test Azure AD OAuth login (dev)
- [ ] Test email/password registration (dev)
- [ ] Verify auth works in staging
- [ ] Verify auth works in production

### Feature Testing
- [ ] Create a collection
- [ ] Upload a document
- [ ] Verify document processing
- [ ] Test chat functionality
- [ ] Verify vector search works
- [ ] Test file downloads from MinIO

## Step 9: Monitoring Setup

### Application Monitoring
- [ ] Check Grafana dashboards: https://grafana.huberty.pro
- [ ] Verify Docuralis metrics are being collected
- [ ] Set up alerts for pod restarts
- [ ] Set up alerts for high error rates

### Log Monitoring
- [ ] Check Loki for Docuralis logs
- [ ] Set up log-based alerts
- [ ] Create saved queries for common errors

### ArgoCD Monitoring
- [ ] Verify all apps show "Healthy" and "Synced"
- [ ] Set up ArgoCD notifications (optional)
- [ ] Configure sync waves if needed

## Step 10: Documentation and Handoff

### Update Documentation
- [ ] Update README with new deployment info
- [ ] Document any custom configurations
- [ ] Add troubleshooting steps for common issues
- [ ] Document rollback procedures

### Team Handoff
- [ ] Share Vault credentials securely
- [ ] Share ArgoCD credentials
- [ ] Share Grafana credentials
- [ ] Provide access to GitHub repository
- [ ] Walk through deployment process with team

### Backup and Disaster Recovery
- [ ] Document backup procedures
- [ ] Test database restore procedure
- [ ] Document disaster recovery plan
- [ ] Set up automated backups (Velero)

## Post-Deployment Checklist

### Security
- [ ] Change all default passwords in production
- [ ] Rotate Vault secrets
- [ ] Enable RBAC policies in Vault
- [ ] Review network policies
- [ ] Enable pod security policies
- [ ] Set up WAF rules (if applicable)

### Performance
- [ ] Monitor resource usage
- [ ] Adjust resource requests/limits if needed
- [ ] Set up horizontal pod autoscaling (optional)
- [ ] Configure caching strategies

### Maintenance
- [ ] Schedule regular secret rotation
- [ ] Plan for certificate renewal (automatic, but verify)
- [ ] Set up automated security scanning
- [ ] Plan for regular updates

## Troubleshooting Common Issues

### ImagePullBackOff
- [ ] Verify image exists in GHCR
- [ ] Check image pull secret exists
- [ ] Verify GITHUB_TOKEN permissions
- [ ] Make GHCR package public or update credentials

### CrashLoopBackOff
- [ ] Check pod logs: `kubectl logs -n dev <pod-name>`
- [ ] Verify all secrets exist
- [ ] Check database connectivity
- [ ] Verify environment variables are correct

### ExternalSecret Not Syncing
- [ ] Check External Secrets Operator logs
- [ ] Verify Vault connectivity
- [ ] Check Vault token is valid
- [ ] Verify secret paths in Vault are correct

### Certificate Not Ready
- [ ] Check cert-manager logs
- [ ] Verify Cloudflare API token is correct
- [ ] Check DNS record exists
- [ ] Wait longer (can take 5 minutes)

### Deployment Not Syncing in ArgoCD
- [ ] Check ArgoCD application controller logs
- [ ] Verify repository is accessible
- [ ] Check branch names are correct
- [ ] Force refresh: `argocd app get docuralis-dev --refresh`

## Rollback Procedures

### Application Rollback
- [ ] Use ArgoCD to rollback: `argocd app rollback docuralis-production <revision>`
- [ ] Or use kubectl: `kubectl rollout undo deployment/prod-docuralis -n production`

### Database Rollback
- [ ] Restore from backup
- [ ] Revert Prisma migrations if needed

### Complete Rollback to Old Setup
- [ ] Revert git changes
- [ ] Restore old manifests
- [ ] Redeploy via ArgoCD

## Success Criteria

- [✅] All pods are Running
- [✅] All health checks return 200 OK
- [✅] DNS records are correct
- [✅] TLS certificates are valid
- [✅] Applications are accessible via browser
- [✅] Authentication works
- [✅] Database connections work
- [✅] File uploads work (MinIO)
- [✅] Vector search works (Qdrant)
- [✅] Logs are being collected
- [✅] Metrics are being collected
- [✅] ArgoCD shows Healthy and Synced

## Notes

- Use this checklist for each environment (dev, staging, production)
- Start with dev, verify everything works, then move to staging, then production
- Document any issues encountered and solutions
- Keep this checklist updated with lessons learned

---

**Last Updated**: 2025-10-22
**Deployment Team**: Your Team Name
**Contact**: your-email@example.com
