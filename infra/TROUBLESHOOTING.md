# Troubleshooting et Corrections Appliquées

## Corrections Effectuées le 13 Octobre 2025

### 1. Problème d'Accès à Argo CD via Ingress

**Symptôme**: https://argocd.huberty.pro ne fonctionnait pas, mais l'accès direct via IP:port fonctionnait

**Cause**:
- Le service argocd-server était configuré en NodePort au lieu de ClusterIP
- Argo CD n'était pas en mode "insecure" (nécessaire pour que Traefik gère le TLS)

**Solution Appliquée**:

```bash
# 1. Changer le service de NodePort à ClusterIP
kubectl patch svc argocd-server -n argocd -p '{"spec":{"type":"ClusterIP"}}'

# 2. Activer le mode insecure d'Argo CD
kubectl patch cm argocd-cmd-params-cm -n argocd --type merge -p '{"data":{"server.insecure":"true"}}'

# 3. Redémarrer Argo CD
kubectl rollout restart deployment argocd-server -n argocd
```

**Résultat**: ✅ Argo CD est maintenant accessible via https://argocd.huberty.pro

---

### 2. Problème Demo App - Pods ne Démarrent Pas

**Symptôme**: Le déploiement demo-app affichait 0/2 pods prêts

**Cause**: ServiceAccount "demo-app" manquant

**Solution Appliquée**:

```bash
# Créer le ServiceAccount manquant
kubectl create serviceaccount demo-app -n demo-app

# Redémarrer le déploiement
kubectl rollout restart deployment demo-app -n demo-app
```

**Résultat**: ✅ Demo App est maintenant accessible via https://demo.huberty.pro

---

### 3. Problème Certificats TLS (Grafana et Vault)

**Symptôme**: Certificats en état "Failed" pour Grafana et Vault

**Cause**: Échec initial des requêtes ACME vers Let's Encrypt

**Solution Appliquée**:

```bash
# Supprimer les certificats en échec
kubectl delete certificate grafana-tls -n monitoring
kubectl delete certificate vault-tls -n vault

# Les Ingress vont automatiquement recréer les certificats
# Attendre 1-2 minutes pour que Let's Encrypt valide via DNS-01 challenge
```

**Résultat**: ✅ Tous les certificats sont maintenant valides jusqu'au 11/01/2026

---

## État Actuel de l'Infrastructure

### Services Fonctionnels

| Service | URL | Status | Certificat TLS |
|---------|-----|--------|----------------|
| **Argo CD** | https://argocd.huberty.pro | ✅ Running | ✅ Valid |
| **Grafana** | https://grafana.huberty.pro | ✅ Running | ✅ Valid |
| **Vault** | https://vault.huberty.pro | ⚠️ Needs Init | ✅ Valid |
| **Demo App** | https://demo.huberty.pro | ✅ Running | ✅ Valid |

### Commandes de Vérification

```bash
# Vérifier l'état de tous les services
kubectl get pods -A | grep -E "(argocd|vault|monitoring|demo-app)"

# Vérifier les certificats TLS
kubectl get certificates -A

# Vérifier les Ingress
kubectl get ingress -A

# Tester l'accès aux services
curl -k -I https://argocd.huberty.pro    # Devrait retourner HTTP/2 200
curl -k -I https://grafana.huberty.pro   # Devrait retourner HTTP/2 302
curl -k -I https://vault.huberty.pro     # Devrait retourner HTTP/2 307
curl -k -I https://demo.huberty.pro      # Devrait retourner HTTP/2 200
```

---

## Problèmes Connus et Solutions

### Argo CD - Accès Initial

Après le premier déploiement, Argo CD peut être accessible via NodePort avant la configuration de l'Ingress. Si vous rencontrez ce problème :

1. Vérifier que le service est en ClusterIP :
```bash
kubectl get svc argocd-server -n argocd
# Type doit être: ClusterIP
```

2. Si ce n'est pas le cas, patcher le service :
```bash
kubectl patch svc argocd-server -n argocd -p '{"spec":{"type":"ClusterIP"}}'
```

### Certificats TLS - Échec de Validation

Si les certificats restent en état "False" après 10 minutes :

1. Vérifier les logs de cert-manager :
```bash
kubectl logs -n cert-manager -l app=cert-manager --tail=50
```

2. Vérifier l'état des challenges ACME :
```bash
kubectl get challenges -A
```

3. Si nécessaire, supprimer et recréer le certificat :
```bash
kubectl delete certificate <cert-name> -n <namespace>
# Le certificat sera automatiquement recréé par l'Ingress
```

### ExternalDNS - DNS non Créés

Si les enregistrements DNS ne sont pas créés dans Cloudflare :

1. Vérifier les logs d'ExternalDNS :
```bash
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns --tail=50
```

2. Vérifier le secret Cloudflare :
```bash
kubectl get secret cloudflare-api-token -n external-dns -o yaml
```

3. Si le token est invalide, le recréer :
```bash
kubectl delete secret cloudflare-api-token -n external-dns
kubectl create secret generic cloudflare-api-token \
  --from-literal=CF_API_TOKEN="votre-token-ici" \
  -n external-dns
kubectl rollout restart deployment external-dns -n external-dns
```

---

## Initialisation de Vault

Vault a été déployé mais nécessite une initialisation manuelle :

```bash
# 1. Obtenir le pod Vault
VAULT_POD=$(kubectl get pod -n vault -l app.kubernetes.io/name=vault -o jsonpath='{.items[0].metadata.name}')

# 2. Initialiser Vault (génère 5 unseal keys et 1 root token)
kubectl exec -n vault $VAULT_POD -- vault operator init

# 3. IMPORTANT: Sauvegarder les clés d'unsealing et le root token !

# 4. Unseal Vault avec 3 des 5 clés
kubectl exec -n vault $VAULT_POD -- vault operator unseal <key-1>
kubectl exec -n vault $VAULT_POD -- vault operator unseal <key-2>
kubectl exec -n vault $VAULT_POD -- vault operator unseal <key-3>

# 5. Se connecter à Vault
kubectl exec -n vault $VAULT_POD -- vault login <root-token>

# 6. Créer un secret de test
kubectl exec -n vault $VAULT_POD -- vault kv put secret/demo-app/config \
  database_url="postgresql://localhost:5432/mydb" \
  api_key="test-api-key"
```

Après initialisation, Vault sera accessible via https://vault.huberty.pro

---

## Architecture Réseau

### Flux de Trafic

```
Internet
    ↓
Cloudflare DNS (huberty.pro)
    ↓
VPS IP: 46.202.129.66
    ↓
Traefik Ingress Controller (K3s)
    ↓ (TLS terminé ici)
Services ClusterIP (HTTP interne)
    ↓
Pods applicatifs
```

### Configuration Réseau

- **IP Externe**: 46.202.129.66 (VPS Hostinger)
- **MetalLB Range**: 192.168.1.240-192.168.1.250 (non utilisé en VPS)
- **DNS Provider**: Cloudflare (géré par ExternalDNS)
- **TLS Provider**: Let's Encrypt (géré par cert-manager via DNS-01)
- **Ingress Controller**: Traefik (intégré K3s)

---

## Maintenance et Surveillance

### Commandes Utiles Quotidiennes

```bash
# Vue d'ensemble du cluster
kubectl get nodes
kubectl get pods -A | grep -v Running | grep -v Completed

# Vérifier les certificats (doivent tous être Ready=True)
kubectl get certificates -A

# Vérifier les Ingress
kubectl get ingress -A

# Logs des composants critiques
kubectl logs -n cert-manager -l app=cert-manager --tail=50
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns --tail=50
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server --tail=50
```

### Métriques et Alertes

Accédez à Grafana (https://grafana.huberty.pro) pour surveiller :
- CPU et mémoire du cluster
- Santé des pods
- Trafic réseau
- Logs agrégés (via Loki - à déployer)

---

## Mises à Jour Futures

### Composants à Déployer

- [ ] Loki + Promtail (logging centralisé)
- [ ] Rancher (management UI optionnel)
- [ ] External Secrets Operator (intégration Vault ↔ K8s)
- [ ] Network Policies (sécurité réseau)

### Améliorations de Sécurité

1. Changer le mot de passe Grafana par défaut
2. Configurer RBAC dans Argo CD
3. Mettre en place des Network Policies
4. Activer l'audit logging
5. Configurer des alertes dans Alertmanager

---

**Documentation mise à jour le**: 13 Octobre 2025
**Version du cluster**: K3s v1.33.5+k3s1
**Nombre de nœuds**: 2 (1 master + 1 agent)
