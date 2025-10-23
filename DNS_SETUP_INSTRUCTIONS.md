# DNS Setup Instructions for docuralis.com

## Required DNS Records

Add these A records to your `docuralis.com` DNS zone:

```
Type: A
Name: dev
Value: 46.202.129.66
TTL: Auto (or 300)

Type: A
Name: staging
Value: 46.202.129.66
TTL: Auto (or 300)

Type: A
Name: app
Value: 46.202.129.66
TTL: Auto (or 300)
```

This will create:
- `dev.docuralis.com` → 46.202.129.66
- `staging.docuralis.com` → 46.202.129.66
- `app.docuralis.com` → 46.202.129.66

## If Using Cloudflare

1. Go to https://dash.cloudflare.com
2. Select your `docuralis.com` domain
3. Go to DNS → Records
4. Click "Add record"
5. Add each record as shown above
6. **Important**: Toggle "Proxy status" to **DNS only** (gray cloud, not orange)
   - This is necessary because Traefik handles SSL termination
   - Orange cloud (proxied) can cause issues with Let's Encrypt

## If Using Another DNS Provider

Follow your DNS provider's instructions to add A records pointing to `46.202.129.66`.

## Verify DNS Setup

After adding records, wait 1-5 minutes for propagation, then verify:

```bash
# Check DNS resolution
dig dev.docuralis.com
dig staging.docuralis.com
dig app.docuralis.com

# All should return: 46.202.129.66

# Alternative verification
nslookup dev.docuralis.com
nslookup staging.docuralis.com
nslookup app.docuralis.com
```

## Cloudflare API Token for ExternalDNS

If you want ExternalDNS to automatically manage these records:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit zone DNS" template
4. Configure:
   - Permissions: Zone → DNS → Edit
   - Zone Resources: Include → Specific zone → docuralis.com
5. Copy the token
6. Update the Kubernetes secret:

```bash
kubectl create secret generic cloudflare-api-token \
  --from-literal=cloudflare_api_token=YOUR_TOKEN_HERE \
  --namespace=external-dns \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart ExternalDNS
kubectl rollout restart deployment/external-dns -n external-dns
```

## Test Connectivity

Once DNS is set up and the application is deployed:

```bash
# Test HTTP response (may fail if TLS not ready)
curl -I https://dev.docuralis.com

# Test health endpoint
curl https://dev.docuralis.com/api/health

# Expected: {"status":"ok","timestamp":"..."}
```

## Troubleshooting

### DNS not resolving
- **Wait**: DNS propagation can take 5-15 minutes
- **Check**: Use `dig` or `nslookup` to verify
- **Clear cache**: `sudo dscacheutil -flushcache` (macOS) or restart router

### Certificate errors (HTTPS)
- **Wait**: Let's Encrypt can take 2-5 minutes to issue certificates
- **Check**: `kubectl get certificates -n dev`
- **Verify**: DNS must resolve before cert-manager can issue certificates

### "Connection refused" or timeout
- **Check firewall**: Ensure ports 80 and 443 are open on your server
- **Check Traefik**: `kubectl get pods -n kube-system | grep traefik`
- **Check ingress**: `kubectl get ingress -n dev`

## Next Steps

After DNS is configured:
1. Follow the migration guide: `MIGRATION_TO_DOCURALIS_COM.md`
2. Run deployment script: `./scripts/deploy-docuralis.sh`
3. Verify deployments and test applications
