/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  Mail,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'

export default function InvitePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [invitation, setInvitation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // If not authenticated, redirect to login with return URL
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/invite/${token}`)
      return
    }

    // Fetch invitation details
    if (status === 'authenticated' && token) {
      fetchInvitation()
    }
  }, [status, token, router])

  const fetchInvitation = async () => {
    try {
      const res = await fetch(`/api/invite/${token}`)
      if (res.ok) {
        const data = await res.json()
        setInvitation(data.invitation)
      } else {
        const error = await res.json()
        setError(error.error || 'Invalid or expired invitation')
      }
    } catch (err) {
      setError('Failed to load invitation')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvitation = async () => {
    setAccepting(true)
    setError(null)

    try {
      const res = await fetch(`/api/invite/${token}/accept`, {
        method: 'POST',
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard?tab=teams')
        }, 2000)
      } else {
        const error = await res.json()
        setError(error.error || 'Failed to accept invitation')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setAccepting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome to the team!</h1>
            <p className="text-muted-foreground mb-6">
              You've successfully joined the organization. Redirecting to your
              dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
            <p className="text-muted-foreground mb-6">
              {error || 'This invitation link is invalid or has expired.'}
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="rounded-xl border border-border bg-card p-8">
          {/* Icon */}
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Users className="h-8 w-8 text-primary" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mb-2">
            You've Been Invited!
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Join your team on Docuralis
          </p>

          {/* Invitation Details */}
          <div className="space-y-4 mb-8">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3 mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-semibold">
                    {invitation.organization.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Your Role</p>
                  <p className="font-semibold">{invitation.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Invited by</p>
                  <p className="font-semibold">
                    {invitation.invitedBy?.name ||
                      invitation.invitedBy?.email ||
                      'A team member'}
                  </p>
                </div>
              </div>
            </div>

            {/* Signed in as */}
            {session?.user && (
              <div className="text-center text-sm text-muted-foreground">
                Signed in as{' '}
                <span className="font-medium">{session.user.email}</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Accept Button */}
          <button
            onClick={handleAcceptInvitation}
            disabled={accepting}
            className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50 font-medium"
          >
            {accepting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Accepting...
              </span>
            ) : (
              'Accept Invitation'
            )}
          </button>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Not you?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in with a different account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
