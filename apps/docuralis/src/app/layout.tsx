import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { AuthProvider } from '@/components/session-provider'
import { PostHogProvider, PostHogPageView } from './providers'
import { Suspense } from 'react'
import './globals.css'

// Use system fonts as fallback when Google Fonts is unavailable
const fontVariables = {
  sans: '--font-geist-sans',
  mono: '--font-geist-mono',
}

export const metadata: Metadata = {
  title: 'Docuralis',
  description: 'Docuralis - RAG',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const messages = await getMessages()

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
        style={{
          [`${fontVariables.sans}` as string]:
            'system-ui, -apple-system, sans-serif',
          [`${fontVariables.mono}` as string]: 'ui-monospace, monospace',
        }}
      >
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <NextIntlClientProvider messages={messages}>
            <AuthProvider>{children}</AuthProvider>
          </NextIntlClientProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
