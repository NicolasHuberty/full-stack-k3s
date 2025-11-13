import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAgentService } from '@/lib/agents/service';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentService = getAgentService();
    const agents = await agentService.getMarketplaceAgents(session.user.id);

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to get agents:', error);
    return NextResponse.json(
      { error: 'Failed to get agents' },
      { status: 500 }
    );
  }
}
