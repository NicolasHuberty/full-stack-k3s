import { NextResponse } from 'next/server';
import { getCoreV1Api, formatAge } from '@/lib/k8s-client';

export async function GET() {
  try {
    const k8sApi = getCoreV1Api();
    const response = await k8sApi.listServiceForAllNamespaces();

    const services = response.body.items.map((service) => {
      const ports = (service.spec?.ports || [])
        .map((port) => {
          if (port.nodePort) {
            return `${port.port}:${port.nodePort}/${port.protocol}`;
          }
          return `${port.port}/${port.protocol}`;
        })
        .join(', ');

      return {
        name: service.metadata?.name || 'Unknown',
        namespace: service.metadata?.namespace || 'default',
        type: service.spec?.type || 'ClusterIP',
        clusterIp: service.spec?.clusterIP || 'None',
        ports: ports || 'None',
        age: formatAge(service.metadata?.creationTimestamp),
      };
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
