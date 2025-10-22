import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updatePlanSchema = z.object({
  planType: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { planType } = updatePlanSchema.parse(body)

    // Define storage limits based on plan
    const storageLimits = {
      FREE: BigInt(5368709120), // 5GB
      STARTER: BigInt(53687091200), // 50GB
      PRO: BigInt(268435456000), // 250GB
      ENTERPRISE: BigInt(1099511627776), // 1TB
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        planType,
        planStatus: 'ACTIVE',
        planStartDate: new Date(),
        storageLimit: storageLimits[planType],
      },
    })

    return NextResponse.json({ success: true, planType: user.planType })
  } catch (error) {
    console.error('Failed to update plan:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    )
  }
}
