import * as k8s from '@kubernetes/client-node';

let kc: k8s.KubeConfig | null = null;

export function getKubeConfig(): k8s.KubeConfig {
  if (!kc) {
    kc = new k8s.KubeConfig();

    // Try in-cluster config first (when running inside Kubernetes)
    try {
      kc.loadFromCluster();
      console.log('Using in-cluster Kubernetes configuration');
    } catch (e) {
      // Fall back to default config (kubeconfig file)
      try {
        kc.loadFromDefault();
        console.log('Using default Kubernetes configuration');
      } catch (err) {
        console.error('Failed to load Kubernetes configuration:', err);
        throw err;
      }
    }
  }
  return kc;
}

export function getCoreV1Api(): k8s.CoreV1Api {
  const kubeConfig = getKubeConfig();
  return kubeConfig.makeApiClient(k8s.CoreV1Api);
}

export function getAppsV1Api(): k8s.AppsV1Api {
  const kubeConfig = getKubeConfig();
  return kubeConfig.makeApiClient(k8s.AppsV1Api);
}

export function formatAge(creationTimestamp: string | undefined): string {
  if (!creationTimestamp) return 'Unknown';

  const created = new Date(creationTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return '<1m';
}
