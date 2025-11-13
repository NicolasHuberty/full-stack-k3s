import { NextResponse } from 'next/server';
import { getKubeConfig, getCoreV1Api } from '@/lib/k8s-client';
import * as k8s from '@kubernetes/client-node';

export async function GET() {
  try {
    const kc = getKubeConfig();
    const k8sApi = getCoreV1Api();

    const currentContext = kc.getCurrentContext();
    const cluster = kc.getCurrentCluster();

    // Get nodes to count them
    const nodesResponse = await k8sApi.listNode();
    const nodeCount = nodesResponse.body.items.length;

    // Try to get server version
    let version = 'Unknown';
    try {
      const versionApi = kc.makeApiClient(k8s.VersionApi);
      const versionInfo = await versionApi.getCode();
      version = versionInfo.body.gitVersion || 'Unknown';
    } catch (error) {
      // Version API might not be available, use fallback
      version = 'K8s';
    }

    return NextResponse.json({
      version,
      nodeCount,
      context: currentContext,
      clusterName: cluster?.name || 'Unknown',
    });
  } catch (error) {
    console.error('Error fetching cluster info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cluster info' },
      { status: 500 }
    );
  }
}
