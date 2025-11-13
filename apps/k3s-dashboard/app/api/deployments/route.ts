import { NextResponse } from 'next/server';
import { getAppsV1Api, formatAge } from '@/lib/k8s-client';

export async function GET() {
  try {
    const k8sApi = getAppsV1Api();
    const response = await k8sApi.listDeploymentForAllNamespaces();

    const deployments = response.body.items.map((deployment) => {
      const replicas = deployment.spec?.replicas || 0;
      const readyReplicas = deployment.status?.readyReplicas || 0;

      return {
        name: deployment.metadata?.name || 'Unknown',
        namespace: deployment.metadata?.namespace || 'default',
        ready: `${readyReplicas}/${replicas}`,
        upToDate: deployment.status?.updatedReplicas || 0,
        available: deployment.status?.availableReplicas || 0,
        age: formatAge(deployment.metadata?.creationTimestamp),
      };
    });

    return NextResponse.json(deployments);
  } catch (error) {
    console.error('Error fetching deployments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployments' },
      { status: 500 }
    );
  }
}
