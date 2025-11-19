/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import { Plus, Users, Mail, X, Clock, Trash2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function TeamsPage() {
  const t = useTranslations('teams')
  const [organizations, setOrganizations] = useState<any[]>([])
  const [selectedOrg, setSelectedOrg] = useState<any>(null)
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgDomain, setOrgDomain] = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>(
    'MEMBER'
  )

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean
    invitationId: string | null
  }>({ show: false, invitationId: null })

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data.organizations)
        if (data.organizations.length > 0 && !selectedOrg) {
          const org = data.organizations[0]
          fetchOrganizationDetails(org.organization?.id || org.id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    }
  }

  const fetchOrganizationDetails = async (orgId: string) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedOrg(data.organization)
      }
    } catch (error) {
      console.error('Failed to fetch organization details:', error)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          slug: orgSlug,
          domain: orgDomain || undefined,
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: t('createSuccess') })
        setShowCreateOrgModal(false)
        setOrgName('')
        setOrgSlug('')
        setOrgDomain('')
        await fetchOrganizations()
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.error || t('createError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('createError') })
    } finally {
      setLoading(false)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrg) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: t('inviteSuccess') })
        setShowInviteModal(false)
        setInviteEmail('')
        setInviteRole('MEMBER')
        await fetchOrganizationDetails(selectedOrg.id)
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.error || t('inviteError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('inviteError') })
    } finally {
      setLoading(false)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    if (!selectedOrg) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch(
        `/api/organizations/${selectedOrg.id}/invitations/${invitationId}/resend`,
        {
          method: 'POST',
        }
      )

      if (res.ok) {
        setMessage({ type: 'success', text: t('resendSuccess') })
        await fetchOrganizationDetails(selectedOrg.id)
      } else {
        const error = await res.json()
        setMessage({
          type: 'error',
          text: error.error || t('resendError'),
        })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('resendError') })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInvitation = async () => {
    if (!selectedOrg || !deleteConfirmation.invitationId) return

    setLoading(true)
    setMessage(null)
    setDeleteConfirmation({ show: false, invitationId: null })

    try {
      const res = await fetch(
        `/api/organizations/${selectedOrg.id}/invitations/${deleteConfirmation.invitationId}`,
        {
          method: 'DELETE',
        }
      )

      if (res.ok) {
        setMessage({ type: 'success', text: t('deleteInvitationSuccess') })
        await fetchOrganizationDetails(selectedOrg.id)
      } else {
        const error = await res.json()
        setMessage({
          type: 'error',
          text: error.error || t('deleteInvitationError'),
        })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('deleteInvitationError') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex gap-3">
            {organizations.length === 0 && (
              <Button
                onClick={() => setShowCreateOrgModal(true)}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('createOrganization')}
              </Button>
            )}
            {selectedOrg && (
              <Button onClick={() => setShowInviteModal(true)}>
                <Mail className="h-4 w-4 mr-2" />
                {t('inviteMembers')}
              </Button>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}
          >
            {message.text}
          </div>
        )}

        {organizations.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {t('noOrganization')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t('noOrganizationDesc')}
            </p>
            <Button onClick={() => setShowCreateOrgModal(true)}>
              {t('createFirst')}
            </Button>
          </div>
        ) : (
          selectedOrg && (
            <div className="space-y-6">
              {/* Organization info */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold mb-4">
                  {t('organizationDetails')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('name')}</p>
                    <p className="font-medium">{selectedOrg.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('plan')}</p>
                    <p className="font-medium">{selectedOrg.planType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('seatsUsed')}
                    </p>
                    <p className="font-medium">
                      {selectedOrg.seatsUsed} / {selectedOrg.seatsTotal}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('members')}
                    </p>
                    <p className="font-medium">
                      {selectedOrg.members?.length || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Team Members */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold mb-4">{t('teamMembers')}</h3>
                <div className="space-y-3">
                  {selectedOrg.members?.map((member: any) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        {member.user.image ? (
                          <Image
                            src={member.user.image}
                            alt={member.user.name || 'User'}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="font-medium text-sm">
                              {member.user.name?.[0]?.toUpperCase() ||
                                member.user.email[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {member.user.name || 'Unnamed'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.user.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${member.role === 'OWNER'
                          ? 'bg-purple-500/10 text-purple-600'
                          : member.role === 'ADMIN'
                            ? 'bg-blue-500/10 text-blue-600'
                            : member.role === 'MEMBER'
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-gray-500/10 text-gray-600'
                          }`}
                      >
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Invitations */}
              {selectedOrg.invitations &&
                selectedOrg.invitations.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="font-semibold mb-4">
                      {t('pendingInvitations')}
                    </h3>
                    <div className="space-y-3">
                      {selectedOrg.invitations.map((invitation: any) => (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                              <Clock className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-medium">{invitation.email}</p>
                              <p className="text-sm text-muted-foreground">
                                {t('invitedBy')}{' '}
                                {invitation.invitedBy?.name || 'Unknown'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600">
                              {invitation.role}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleResendInvitation(invitation.id)
                              }
                              disabled={loading}
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              {t('resendInvitation')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() =>
                                setDeleteConfirmation({
                                  show: true,
                                  invitationId: invitation.id,
                                })
                              }
                              disabled={loading}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {t('delete')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )
        )}

        {/* Create Organization Modal */}
        {showCreateOrgModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {t('createOrganization')}
                </h2>
                <button
                  onClick={() => setShowCreateOrgModal(false)}
                  className="p-1 hover:bg-muted/50 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrganization} className="space-y-4">
                <div>
                  <Label>{t('organizationName')}</Label>
                  <Input
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value)
                      setOrgSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '-')
                          .replace(/[^a-z0-9-]/g, '')
                      )
                    }}
                    placeholder={t('organizationNamePlaceholder')}
                    required
                  />
                </div>

                <div>
                  <Label>{t('organizationSlug')}</Label>
                  <Input
                    value={orgSlug}
                    onChange={(e) =>
                      setOrgSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '-')
                          .replace(/[^a-z0-9-]/g, '')
                      )
                    }
                    placeholder={t('organizationSlugPlaceholder')}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('slugHelp')}
                  </p>
                </div>

                <div>
                  <Label>{t('domainOptional')}</Label>
                  <Input
                    value={orgDomain}
                    onChange={(e) => setOrgDomain(e.target.value)}
                    placeholder={t('domainPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('domainHelp')}
                  </p>
                </div>

                {message && (
                  <div
                    className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}
                  >
                    {message.text}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateOrgModal(false)}
                    className="flex-1"
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? t('creating') : t('create')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invite Member Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {t('inviteTeamMember')}
                </h2>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-1 hover:bg-muted/50 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleInviteMember} className="space-y-4">
                <div>
                  <Label>{t('emailAddress')}</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('emailHelp')}
                  </p>
                </div>

                <div>
                  <Label>{t('role')}</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value: any) => setInviteRole(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">{t('roleMember')}</SelectItem>
                      <SelectItem value="ADMIN">{t('roleAdmin')}</SelectItem>
                      <SelectItem value="VIEWER">{t('roleViewer')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {message && (
                  <div
                    className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}
                  >
                    {message.text}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1"
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? t('sending') : t('sendInvitation')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Invitation Confirmation Modal */}
        {deleteConfirmation.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-red-600">
                  {t('delete')}
                </h2>
                <button
                  onClick={() =>
                    setDeleteConfirmation({ show: false, invitationId: null })
                  }
                  className="p-1 hover:bg-muted/50 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-muted-foreground mb-6">
                {t('confirmDeleteInvitation')}
              </p>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setDeleteConfirmation({ show: false, invitationId: null })
                  }
                  className="flex-1"
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleDeleteInvitation}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? t('deleting') : t('delete')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
