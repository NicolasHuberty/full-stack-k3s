import { NextResponse } from 'next/server';
import { getCoreV1Api, formatAge } from '@/lib/k8s-client';

function parseResource(value: string | undefined): number {
  if (!value) return 0;

  if (value.endsWith('Ki')) {
    return parseInt(value.slice(0, -2)) / 1024;
  } else if (value.endsWith('Mi')) {
    return parseInt(value.slice(0, -2));
  } else if (value.endsWith('Gi')) {
    return parseInt(value.slice(0, -2)) * 1024;
  } else if (value.endsWith('m')) {
    return parseInt(value.slice(0, -1)) / 1000;
  } else if (value.endsWith('n')) {
    return parseInt(value.slice(0, -1)) / 1000000000;
  } else if (value.endsWith('u')) {
    return parseInt(value.slice(0, -1)) / 1000000;
  }

  return parseFloat(value) || 0;
}

function matchesSelector(podLabels: { [key: string]: string }, selector: { [key: string]: string }): boolean {
  if (!selector || Object.keys(selector).length === 0) {
    return false;
  }

  for (const [key, value] of Object.entries(selector)) {
    if (podLabels[key] !== value) {
      return false;
    }
  }

  return true;
}

export async function GET() {
  try {
    const k8sApi = getCoreV1Api();

    const [servicesResponse, podsResponse] = await Promise.all([
      k8sApi.listServiceForAllNamespaces(),
      k8sApi.listPodForAllNamespaces(),
    ]);

    const services = servicesResponse.body.items.map((service) => {
      const ports = (service.spec?.ports || [])
        .map((port) => {
          if (port.nodePort) {
            return `${port.port}:${port.nodePort}/${port.protocol}`;
          }
          return `${port.port}/${port.protocol}`;
        })
        .join(', ');

      const selector = service.spec?.selector || {};
      const namespace = service.metadata?.namespace || 'default';

      // Find pods that match this service's selector and are in the same namespace
      const matchingPods = podsResponse.body.items.filter((pod) => {
        const podLabels = pod.metadata?.labels || {};
        const podNamespace = pod.metadata?.namespace || 'default';
        return podNamespace === namespace && matchesSelector(podLabels, selector);
      });

      const pods = matchingPods.map((pod) => {
        const containerStatuses = pod.status?.containerStatuses || [];
        const restarts = containerStatuses.reduce(
          (sum, container) => sum + (container.restartCount || 0),
          0
        );

        // Get resource requests and limits
        const containers = pod.spec?.containers || [];
        let cpuRequest = 0;
        let memoryRequest = 0;
        let cpuLimit = 0;
        let memoryLimit = 0;

        containers.forEach((container) => {
          const requests = container.resources?.requests || {};
          const limits = container.resources?.limits || {};

          cpuRequest += parseResource(requests.cpu);
          memoryRequest += parseResource(requests.memory);
          cpuLimit += parseResource(limits.cpu);
          memoryLimit += parseResource(limits.memory);
        });

        return {
          name: pod.metadata?.name || 'Unknown',
          namespace: pod.metadata?.namespace || 'default',
          status: pod.status?.phase || 'Unknown',
          restarts,
          age: formatAge(pod.metadata?.creationTimestamp),
          node: pod.spec?.nodeName || 'Unknown',
          resources: {
            requests: {
              cpu: cpuRequest,
              memory: memoryRequest,
            },
            limits: {
              cpu: cpuLimit,
              memory: memoryLimit,
            },
          },
        };
      });

      // Calculate total requested resources for the service
      const totalRequests = pods.reduce(
        (acc, pod) => ({
          cpu: acc.cpu + pod.resources.requests.cpu,
          memory: acc.memory + pod.resources.requests.memory,
        }),
        { cpu: 0, memory: 0 }
      );

      const totalLimits = pods.reduce(
        (acc, pod) => ({
          cpu: acc.cpu + pod.resources.limits.cpu,
          memory: acc.memory + pod.resources.limits.memory,
        }),
        { cpu: 0, memory: 0 }
      );

      return {
        name: service.metadata?.name || 'Unknown',
        namespace: service.metadata?.namespace || 'default',
        type: service.spec?.type || 'ClusterIP',
        clusterIp: service.spec?.clusterIP || 'None',
        ports: ports || 'None',
        age: formatAge(service.metadata?.creationTimestamp),
        selector,
        pods,
        podCount: pods.length,
        totalResources: {
          requests: totalRequests,
          limits: totalLimits,
        },
      };
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services with pods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services with pods' },
      { status: 500 }
    );
  }
}
