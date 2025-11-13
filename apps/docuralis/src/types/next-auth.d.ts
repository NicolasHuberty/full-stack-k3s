import { DefaultSession } from 'next-auth'
import { PlanType, PlanStatus } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      planType: PlanType
      planStatus: PlanStatus
      storageUsed: string
      storageLimit: string
      isSystemAdmin: boolean
    } & DefaultSession['user']
  }

  interface User {
    id: string
    planType?: PlanType
    planStatus?: PlanStatus
    isSystemAdmin?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
  }
}
