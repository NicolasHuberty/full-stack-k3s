import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'K3s Dashboard',
  description: 'Kubernetes cluster monitoring dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
