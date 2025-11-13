import { NextResponse } from 'next/server';
import { getCoreV1Api, getKubeConfig } from '@/lib/k8s-client';
import * as k8s from '@kubernetes/client-node';

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
  } else if (value.endsWith('n')) {
    return parseInt(value.slice(0, -1)) / 1000000000;
  }

  return parseFloat(value) || 0;
}

export async function GET() {
  try {
    const k8sApi = getCoreV1Api();
    const kc = getKubeConfig();
    const metricsClient = new k8s.Metrics(kc);

    // Get nodes info
    const nodesResponse = await k8sApi.listNode();
    const nodes = nodesResponse.body.items;

    // Get metrics
    let nodeMetrics;
    try {
      nodeMetrics = await metricsClient.getNodeMetrics();
    } catch (error) {
      console.error('Could not fetch node metrics:', error);
      nodeMetrics = { items: [] };
    }

    // Calculate total capacity and allocatable
    let totalCpuCapacity = 0;
    let totalMemoryCapacity = 0;
    let totalCpuAllocatable = 0;
    let totalMemoryAllocatable = 0;
    let totalStorageCapacity = 0;
    let totalStorageAllocatable = 0;

    nodes.forEach((node) => {
      const capacity = node.status?.capacity || {};
      const allocatable = node.status?.allocatable || {};

      totalCpuCapacity += parseFloat(capacity.cpu || '0');
      totalMemoryCapacity += parseResource(capacity.memory);
      totalStorageCapacity += parseResource(capacity['ephemeral-storage']);

      totalCpuAllocatable += parseFloat(allocatable.cpu || '0');
      totalMemoryAllocatable += parseResource(allocatable.memory);
      totalStorageAllocatable += parseResource(allocatable['ephemeral-storage']);
    });

    // Calculate current usage from metrics
    let totalCpuUsage = 0;
    let totalMemoryUsage = 0;

    nodeMetrics.items.forEach((metric) => {
      const cpu = metric.usage.cpu || '0';
      const memory = metric.usage.memory || '0';

      totalCpuUsage += parseResource(cpu);
      totalMemoryUsage += parseResource(memory);
    });

    // Get pod count
    const podsResponse = await k8sApi.listPodForAllNamespaces();
    const totalPods = podsResponse.body.items.length;
    const runningPods = podsResponse.body.items.filter(
      (pod) => pod.status?.phase === 'Running'
    ).length;

    return NextResponse.json({
      cpu: {
        capacity: totalCpuCapacity.toFixed(2),
        allocatable: totalCpuAllocatable.toFixed(2),
        usage: totalCpuUsage.toFixed(2),
        usagePercent: totalCpuAllocatable > 0
          ? ((totalCpuUsage / totalCpuAllocatable) * 100).toFixed(1)
          : '0',
      },
      memory: {
        capacity: totalMemoryCapacity.toFixed(0),
        allocatable: totalMemoryAllocatable.toFixed(0),
        usage: totalMemoryUsage.toFixed(0),
        usagePercent: totalMemoryAllocatable > 0
          ? ((totalMemoryUsage / totalMemoryAllocatable) * 100).toFixed(1)
          : '0',
      },
      storage: {
        capacity: (totalStorageCapacity / 1024).toFixed(0), // Convert to GiB
        allocatable: (totalStorageAllocatable / 1024).toFixed(0),
      },
      pods: {
        total: totalPods,
        running: runningPods,
      },
      nodeCount: nodes.length,
    });
  } catch (error) {
    console.error('Error fetching cluster resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cluster resources' },
      { status: 500 }
    );
  }
}
