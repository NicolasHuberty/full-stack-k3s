import { NextResponse } from 'next/server';
import { getCoreV1Api } from '@/lib/k8s-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const podName = searchParams.get('pod');
    const namespace = searchParams.get('namespace');

    if (!podName || !namespace) {
      return NextResponse.json(
        { error: 'Pod name and namespace are required' },
        { status: 400 }
      );
    }

    const k8sApi = getCoreV1Api();

    // Get logs (last 100 lines)
    const logsResponse = await k8sApi.readNamespacedPodLog(
      podName,
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      100, // tail lines
      undefined
    );

    return NextResponse.json({
      logs: logsResponse.body,
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
