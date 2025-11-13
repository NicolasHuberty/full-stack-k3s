import { NextResponse } from 'next/server';
import { getKubeConfig } from '@/lib/k8s-client';
import * as k8s from '@kubernetes/client-node';

export async function GET() {
  try {
    const kc = getKubeConfig();
    const metricsClient = new k8s.Metrics(kc);

    const nodeMetrics = await metricsClient.getNodeMetrics();

    const metrics = nodeMetrics.items.map((node) => {
      const cpuUsage = node.usage.cpu;
      const memoryUsage = node.usage.memory;

      return {
        name: node.metadata.name,
        cpu: cpuUsage,
        memory: memoryUsage,
      };
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching node metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch node metrics' },
      { status: 500 }
    );
  }
}
