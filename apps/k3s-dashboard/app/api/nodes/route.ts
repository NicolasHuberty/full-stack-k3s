import { NextResponse } from 'next/server';
import { getCoreV1Api, formatAge } from '@/lib/k8s-client';

function parseResource(value: string | undefined): number {
  if (!value) return 0;

  if (value.endsWith('Ki')) {
    return parseInt(value.slice(0, -2)) / 1024; // Convert to Mi
  } else if (value.endsWith('Mi')) {
    return parseInt(value.slice(0, -2));
  } else if (value.endsWith('Gi')) {
    return parseInt(value.slice(0, -2)) * 1024;
  } else if (value.endsWith('Ti')) {
    return parseInt(value.slice(0, -2)) * 1024 * 1024;
  } else if (value.endsWith('m')) {
    return parseInt(value.slice(0, -1)) / 1000; // millicores to cores
  }

  return parseFloat(value) || 0;
}

export async function GET() {
  try {
    const k8sApi = getCoreV1Api();
    const response = await k8sApi.listNode();

    const nodes = response.body.items.map((node) => {
      const conditions = node.status?.conditions || [];
      const readyCondition = conditions.find((c) => c.type === 'Ready');
      const status = readyCondition?.status === 'True' ? 'Ready' : 'NotReady';

      const roles = Object.keys(node.metadata?.labels || {})
        .filter((label) => label.startsWith('node-role.kubernetes.io/'))
        .map((label) => label.replace('node-role.kubernetes.io/', ''))
        .join(',') || 'none';

      const capacity = node.status?.capacity || {};
      const allocatable = node.status?.allocatable || {};

      // Get network addresses
      const addresses = node.status?.addresses || [];
      const internalIP = addresses.find((a) => a.type === 'InternalIP')?.address || 'N/A';
      const hostname = addresses.find((a) => a.type === 'Hostname')?.address || 'N/A';

      return {
        name: node.metadata?.name || 'Unknown',
        status,
        roles,
        age: formatAge(node.metadata?.creationTimestamp),
        version: node.status?.nodeInfo?.kubeletVersion || 'Unknown',
        capacity: {
          cpu: parseFloat(capacity.cpu || '0'),
          memory: parseResource(capacity.memory),
          storage: parseResource(capacity['ephemeral-storage']),
          pods: parseInt(capacity.pods || '0'),
        },
        allocatable: {
          cpu: parseFloat(allocatable.cpu || '0'),
          memory: parseResource(allocatable.memory),
          storage: parseResource(allocatable['ephemeral-storage']),
          pods: parseInt(allocatable.pods || '0'),
        },
        network: {
          internalIP,
          hostname,
        },
      };
    });

    return NextResponse.json(nodes);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}
