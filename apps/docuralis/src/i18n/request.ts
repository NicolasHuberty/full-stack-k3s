import { getRequestConfig } from 'next-intl/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export default getRequestConfig(async () => {
  // Get user's language preference from session
  const session = await auth()
  let locale = 'en'

  if (session?.user?.id) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { language: true },
      })
      locale = user?.language || 'en'
    } catch (error) {
      console.error('Failed to fetch user language:', error)
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
