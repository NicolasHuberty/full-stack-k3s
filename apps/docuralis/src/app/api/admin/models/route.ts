import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const modelSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  provider: z.string().min(1),
  contextWindow: z.number().optional(),
  maxTokens: z.number().optional(),
  inputPrice: z.number().optional(),
  outputPrice: z.number().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is system admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSystemAdmin: true },
    });

    if (!user?.isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const models = await prisma.lLMModel.findMany({
      orderBy: [{ isDefault: 'desc' }, { provider: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(models);
  } catch (error) {
    console.error('Failed to get models:', error);
    return NextResponse.json({ error: 'Failed to get models' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is system admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSystemAdmin: true },
    });

    if (!user?.isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = modelSchema.parse(body);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.lLMModel.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const model = await prisma.lLMModel.create({
      data,
    });

    return NextResponse.json(model);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to create model:', error);
    return NextResponse.json({ error: 'Failed to create model' }, { status: 500 });
  }
}
