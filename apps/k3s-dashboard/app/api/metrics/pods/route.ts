import { NextResponse } from 'next/server';
import { getKubeConfig } from '@/lib/k8s-client';
import * as k8s from '@kubernetes/client-node';

export async function GET() {
  try {
    const kc = getKubeConfig();
    const metricsClient = new k8s.Metrics(kc);

    const podMetrics = await metricsClient.getPodMetrics();

    const metrics = podMetrics.items.map((pod) => {
      const containers = pod.containers || [];

      // Sum up all container metrics for the pod
      let totalCpu = 0;
      let totalMemory = 0;

      containers.forEach((container) => {
        const cpu = container.usage.cpu;
        const memory = container.usage.memory;

        // Parse CPU (can be in cores like "100m" for 0.1 cores)
        if (cpu.endsWith('n')) {
          totalCpu += parseInt(cpu.slice(0, -1)) / 1000000000;
        } else if (cpu.endsWith('u')) {
          totalCpu += parseInt(cpu.slice(0, -1)) / 1000000;
        } else if (cpu.endsWith('m')) {
          totalCpu += parseInt(cpu.slice(0, -1)) / 1000;
        } else {
          totalCpu += parseFloat(cpu);
        }

        // Parse memory (can be in Ki, Mi, Gi)
        if (memory.endsWith('Ki')) {
          totalMemory += parseInt(memory.slice(0, -2)) * 1024;
        } else if (memory.endsWith('Mi')) {
          totalMemory += parseInt(memory.slice(0, -2)) * 1024 * 1024;
        } else if (memory.endsWith('Gi')) {
          totalMemory += parseInt(memory.slice(0, -2)) * 1024 * 1024 * 1024;
        } else {
          totalMemory += parseInt(memory);
        }
      });

      return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        cpu: totalCpu.toFixed(3), // cores
        memory: Math.round(totalMemory / (1024 * 1024)), // MiB
      };
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching pod metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pod metrics' },
      { status: 500 }
    );
  }
}
