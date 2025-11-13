import { NextResponse } from 'next/server';
import { getCoreV1Api, formatAge } from '@/lib/k8s-client';

export async function GET() {
  try {
    const k8sApi = getCoreV1Api();
    const response = await k8sApi.listPodForAllNamespaces();

    const pods = response.body.items.map((pod) => {
      const containerStatuses = pod.status?.containerStatuses || [];
      const restarts = containerStatuses.reduce(
        (sum, container) => sum + (container.restartCount || 0),
        0
      );

      return {
        name: pod.metadata?.name || 'Unknown',
        namespace: pod.metadata?.namespace || 'default',
        status: pod.status?.phase || 'Unknown',
        restarts,
        age: formatAge(pod.metadata?.creationTimestamp),
        node: pod.spec?.nodeName || 'Unknown',
      };
    });

    return NextResponse.json(pods);
  } catch (error) {
    console.error('Error fetching pods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pods' },
      { status: 500 }
    );
  }
}
