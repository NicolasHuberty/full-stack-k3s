# Déploiement Infrastructure K3s GitOps - Résumé

**Date de déploiement**: 13 Octobre 2025
**Cluster**: K3s v1.33.5+k3s1 sur VPS Hostinger
**Domaine**: huberty.pro
**IP Publique**: 46.202.129.66

---

## Infrastructure Déployée

### Composants Principaux

| Composant | Version | Namespace | Status | URL |
|-----------|---------|-----------|--------|-----|
| **K3s** | v1.33.5+k3s1 | - | ✅ Running | - |
| **Argo CD** | v3.1.8 | argocd | ✅ Running | https://argocd.huberty.pro |
| **Cert-Manager** | v1.19.0 | cert-manager | ✅ Running | - |
| **ExternalDNS** | v0.19.0 | external-dns | ✅ Running | - |
| **Vault** | v1.15.4 | vault | ✅ Running | https://vault.huberty.pro |
| **Prometheus** | Latest | monitoring | ✅ Running | - |
| **Grafana** | Latest | monitoring | ✅ Running | https://grafana.huberty.pro |
| **Alertmanager** | Latest | monitoring | ✅ Running | - |
| **MetalLB** | v0.13.12 | metallb-system | ✅ Running | - |
| **Demo App** | nginx:1.25 | demo-app | ✅ Running | https://demo.huberty.pro |

### Certificats TLS

Tous les certificats sont émis par **Let's Encrypt (Production)** via DNS-01 challenge avec Cloudflare.

| Service | Certificat | Validité | Renouvellement Auto |
|---------|-----------|----------|---------------------|
| argocd.huberty.pro | ✅ Valid | Jusqu'au 11/01/2026 | ✅ Oui |
| grafana.huberty.pro | ✅ Valid | Jusqu'au 11/01/2026 | ✅ Oui |
| vault.huberty.pro | ✅ Valid | Jusqu'au 11/01/2026 | ✅ Oui |
| demo.huberty.pro | ✅ Valid | Jusqu'au 11/01/2026 | ✅ Oui |

### DNS Records (Cloudflare)

Tous les enregistrements DNS sont automatiquement gérés par **ExternalDNS**.

```
argocd.huberty.pro  → 46.202.129.66 (A record, TTL: 1 minute, Proxied)
grafana.huberty.pro → 46.202.129.66 (A record, TTL: 1 minute, Proxied)
vault.huberty.pro   → 46.202.129.66 (A record, TTL: 1 minute, Proxied)
demo.huberty.pro    → 46.202.129.66 (A record, TTL: 1 minute, Proxied)
```

---

## Accès aux Services

### 🎯 Argo CD (GitOps Platform)

- **URL**: https://argocd.huberty.pro
- **Username**: `admin`
- **Password**: `lA2VmLaHD32iZYbG`
- **Fonctionnalités**:
  - Déploiement GitOps automatique
  - Pattern App-of-Apps configuré
  - Sync automatique activé
  - Self-healing activé

### 📊 Grafana (Monitoring Dashboard)

- **URL**: https://grafana.huberty.pro
- **Username**: `admin`
- **Password**: `admin` (**À CHANGER IMMÉDIATEMENT**)
- **Dashboards Préinstallés**:
  - Kubernetes Cluster Overview (ID: 7249)
  - Kubernetes Nodes (ID: 15759)
  - Kubernetes Pods (ID: 15760)
- **Data Sources**:
  - Prometheus (configuré automatiquement)
  - Loki (à configurer après déploiement)

### 🔐 Vault (Secrets Management)

- **URL**: https://vault.huberty.pro
- **Status**: ✅ Initialisé et Unsealed
- **Comment se connecter**:
  1. Aller sur https://vault.huberty.pro
  2. Sélectionner **Method**: `Token`
  3. Entrer le **Root Token** (voir VAULT_CREDENTIALS.md)
  4. Cliquer sur **Sign In**

- **Credentials**: Voir le fichier `VAULT_CREDENTIALS.md` pour:
  - Root Token
  - 5 Unseal Keys (besoin de 3 pour unseal)
  - Instructions complètes

- **⚠️ IMPORTANT**:
  - Sauvegarder VAULT_CREDENTIALS.md en lieu sûr !
  - Ne jamais commiter ce fichier dans Git
  - Distribuer les unseal keys à différentes personnes

### 🎨 Demo App

- **URL**: https://demo.huberty.pro
- **Description**: Application nginx de démonstration montrant toute la stack GitOps
- **Fonctionnalités démontrées**:
  - HTTPS automatique avec Let's Encrypt
  - DNS automatique via ExternalDNS
  - Déploiement via GitOps
  - Certificat TLS valide

---

## Configuration Réseau

### Architecture

```
Internet
    ↓
Cloudflare DNS + Proxy
    ↓
46.202.129.66 (VPS Hostinger)
    ↓
Traefik Ingress Controller
    ↓ (TLS Termination)
Services ClusterIP
    ↓
Application Pods
```

### Flux de Trafic

1. **Requête HTTPS** → argocd.huberty.pro
2. **DNS Cloudflare** → Résout vers 46.202.129.66
3. **Traefik** → Route vers service argocd-server:80
4. **Service ClusterIP** → Load balance vers pods argocd-server
5. **Pod Argo CD** → Répond en HTTP (Traefik a terminé TLS)

### Sécurité Réseau

- ✅ TLS 1.2+ obligatoire (géré par Traefik)
- ✅ Certificats Let's Encrypt valides
- ✅ Cloudflare Proxy activé (protection DDoS)
- ✅ Services exposés uniquement via Ingress
- ⚠️ Network Policies à implémenter

---

## Corrections Effectuées

### 1. Argo CD - Service Type

**Problème**: Service en NodePort au lieu de ClusterIP
**Impact**: Ingress ne fonctionnait pas
**Solution**:
```bash
kubectl patch svc argocd-server -n argocd -p '{"spec":{"type":"ClusterIP"}}'
```

### 2. Argo CD - Mode Insecure

**Problème**: Argo CD en mode secure, incompatible avec Traefik TLS termination
**Solution**:
```bash
kubectl patch cm argocd-cmd-params-cm -n argocd --type merge -p '{"data":{"server.insecure":"true"}}'
kubectl rollout restart deployment argocd-server -n argocd
```

### 3. Demo App - ServiceAccount Manquant

**Problème**: Pods ne démarraient pas (ServiceAccount demo-app manquant)
**Solution**:
```bash
kubectl create serviceaccount demo-app -n demo-app
kubectl rollout restart deployment demo-app -n demo-app
```

### 4. Certificats TLS - Échec Initial

**Problème**: Certificats Grafana et Vault en erreur
**Solution**:
```bash
kubectl delete certificate grafana-tls -n monitoring
kubectl delete certificate vault-tls -n vault
# Les Ingress ont automatiquement recréé les certificats
```

---

## Commandes de Maintenance

### Vérification Santé du Cluster

```bash
# Vue d'ensemble
kubectl get nodes
kubectl get pods -A | grep -v Running | grep -v Completed

# Services exposés
kubectl get ingress -A
kubectl get svc -A | grep LoadBalancer

# Certificats TLS
kubectl get certificates -A

# Pods par namespace
kubectl get pods -n argocd
kubectl get pods -n monitoring
kubectl get pods -n vault
kubectl get pods -n demo-app
```

### Logs des Composants Critiques

```bash
# Cert-Manager (gestion certificats)
kubectl logs -n cert-manager -l app=cert-manager --tail=50

# ExternalDNS (gestion DNS Cloudflare)
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns --tail=50

# Argo CD (GitOps)
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server --tail=50

# Traefik (Ingress)
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=50
```

### Récupération des Secrets

```bash
# Mot de passe Argo CD
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Mot de passe Grafana
kubectl -n monitoring get secret kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 -d

# Token Cloudflare (ExternalDNS)
kubectl -n external-dns get secret cloudflare-api-token -o jsonpath="{.data.CF_API_TOKEN}" | base64 -d

# Token Cloudflare (Cert-Manager)
kubectl -n cert-manager get secret cloudflare-api-token -o jsonpath="{.data.api-token}" | base64 -d
```

---

## Prochaines Étapes

### À Faire Immédiatement

- [ ] **Changer le mot de passe Grafana** (actuellement "admin")
- [x] **Initialiser Vault** et sauvegarder les clés ✅
- [x] **Sauvegarder** le fichier VAULT_CREDENTIALS.md en lieu sûr ⚠️
- [x] **Tester** tous les accès HTTPS ✅
- [ ] **Configurer** Alertmanager avec notifications

### Améliorations Futures

- [ ] Déployer Loki + Promtail pour logging centralisé
- [ ] Configurer External Secrets Operator
- [ ] Mettre en place des Network Policies
- [ ] Déployer Rancher (optionnel)
- [ ] Configurer RBAC avancé dans Argo CD
- [ ] Mettre en place des backups automatiques Vault
- [ ] Configurer des alertes Prometheus

### Sécurité

- [ ] Activer RBAC strict sur tous les namespaces
- [ ] Configurer Pod Security Standards
- [ ] Mettre en place des Network Policies
- [ ] Activer l'audit logging
- [ ] Scanner les images avec Trivy
- [ ] Configurer OPA (Open Policy Agent)

---

## Ressources et Documentation

### Documentation Officielle

- [K3s](https://docs.k3s.io/)
- [Argo CD](https://argo-cd.readthedocs.io/)
- [Cert-Manager](https://cert-manager.io/docs/)
- [Vault](https://developer.hashicorp.com/vault/docs)
- [Prometheus](https://prometheus.io/docs/)
- [Grafana](https://grafana.com/docs/)

### Fichiers de Configuration

- `bootstrap/` - Scripts et configurations de démarrage
- `apps/` - Manifests des applications (structure Argo CD)
- `manifests/` - Manifests Kubernetes de base
- `ci-cd/` - Pipelines GitHub Actions
- `charts/` - Charts Helm personnalisés

### Support

- **Issues**: Voir `TROUBLESHOOTING.md`
- **Logs**: Utiliser les commandes de logs ci-dessus
- **Monitoring**: Accéder à Grafana pour les métriques

---

## Crédits

**Infrastructure conçue et déployée par**: Claude (Anthropic)
**Date de déploiement**: 13 Octobre 2025
**Cluster Owner**: Nicolas Huberty
**Domaine**: huberty.pro
**Provider**: Hostinger VPS

---

**🎉 Infrastructure GitOps K3s Opérationnelle !**

Tous les services sont accessibles en HTTPS avec des certificats valides.
Les DNS sont automatiquement gérés.
Les déploiements futurs peuvent être faits via Git + Argo CD.

**Happy GitOps! 🚀**
