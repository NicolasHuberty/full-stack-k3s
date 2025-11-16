import { prisma } from '@/lib/prisma'
import { sendEmail } from './email'
import {
  getOrganizationInvitationEmail,
  getMemberAddedEmail,
} from './email-templates'
import crypto from 'crypto'

export async function createOrganization(data: {
  name: string
  slug: string
  ownerId: string
  domain?: string
}) {
  // Create organization
  const organization = await prisma.organization.create({
    data: {
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      seatsUsed: 1, // Owner takes 1 seat
      members: {
        create: {
          userId: data.ownerId,
          role: 'OWNER',
        },
      },
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  })

  return organization
}

export async function inviteMemberToOrganization(data: {
  organizationId: string
  email: string
  role: 'ADMIN' | 'MEMBER' | 'VIEWER'
  invitedById: string
}) {
  // Check if organization has available seats
  const organization = await prisma.organization.findUnique({
    where: { id: data.organizationId },
    include: { members: true },
  })

  if (!organization) {
    throw new Error('Organization not found')
  }

  if (organization.seatsUsed >= organization.seatsTotal) {
    throw new Error('No available seats. Please upgrade your plan.')
  }

  // Check if user is already a member
  const existingMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: data.organizationId,
      user: {
        email: data.email,
      },
    },
  })

  if (existingMember) {
    throw new Error('User is already a member of this organization')
  }

  // Check if invitation already exists
  const existingInvitation = await prisma.organizationInvitation.findFirst({
    where: {
      organizationId: data.organizationId,
      email: data.email,
      status: 'PENDING',
    },
  })

  if (existingInvitation) {
    throw new Error('Invitation already sent to this email')
  }

  // Generate unique token
  const token = crypto.randomBytes(32).toString('hex')

  // Create invitation
  const invitation = await prisma.organizationInvitation.create({
    data: {
      organizationId: data.organizationId,
      email: data.email,
      role: data.role,
      token,
      invitedById: data.invitedById,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    include: {
      organization: true,
      invitedBy: true,
    },
  })

  // Send invitation email (non-blocking - don't fail invitation if email fails)
  const emailContent = getOrganizationInvitationEmail(
    data.email,
    invitation.organization.name,
    invitation.invitedBy?.name || 'A team member',
    token,
    data.role
  )

  // Send email asynchronously - don't block invitation creation
  sendEmail({
    to: data.email,
    subject: emailContent.subject,
    html: emailContent.html,
  }).catch((error) => {
    console.error(
      'Failed to send invitation email (invitation still created):',
      error
    )
    // In development, you might want to log the invitation link
    if (process.env.NODE_ENV === 'development') {
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://docuralis.com'}/invite/${token}`
      console.log(`\n📧 Invitation link for ${data.email}: ${inviteUrl}\n`)
    }
  })

  return invitation
}

/**
 * Resend an invitation email for a pending organization invitation
 * @param invitationId - The ID of the invitation to resend
 * @returns The invitation object
 */
export async function resendInvitationEmail(invitationId: string) {
  // Find the invitation
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { id: invitationId },
    include: {
      organization: true,
      invitedBy: true,
    },
  })

  if (!invitation) {
    throw new Error('Invitation not found')
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Invitation is no longer pending')
  }

  // Check if invitation has expired
  if (invitation.expiresAt < new Date()) {
    // Extend expiration by 7 days
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: { expiresAt: newExpiresAt },
    })
  }

  // Resend invitation email
  const emailContent = getOrganizationInvitationEmail(
    invitation.email,
    invitation.organization.name,
    invitation.invitedBy?.name || 'A team member',
    invitation.token,
    invitation.role
  )

  // Send email asynchronously - don't block
  sendEmail({
    to: invitation.email,
    subject: emailContent.subject,
    html: emailContent.html,
  }).catch((error) => {
    console.error('Failed to resend invitation email:', error)
    // In development, log the invitation link
    if (process.env.NODE_ENV === 'development') {
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://docuralis.com'}/invite/${invitation.token}`
      console.log(
        `\n📧 Resent invitation link for ${invitation.email}: ${inviteUrl}\n`
      )
    }
  })

  return invitation
}

export async function acceptInvitation(token: string, userId: string) {
  console.log('acceptInvitation called with userId:', userId, 'token:', token)

  // Find invitation
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: { organization: true },
  })

  console.log('Invitation found:', invitation ? 'yes' : 'no', invitation?.email)

  if (!invitation) {
    throw new Error('Invitation not found')
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Invitation has already been used or revoked')
  }

  if (invitation.expiresAt < new Date()) {
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    })
    throw new Error('Invitation has expired')
  }

  // Check if organization has available seats
  if (invitation.organization.seatsUsed >= invitation.organization.seatsTotal) {
    throw new Error('Organization has no available seats')
  }

  // Get user
  console.log('Looking up user with ID:', userId)
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  console.log('User found by ID:', user ? 'yes' : 'no', user?.email)

  if (!user) {
    // Try to find user by email as fallback
    const userByEmail = await prisma.user.findUnique({
      where: { email: invitation.email },
    })
    console.log(
      'User found by email:',
      userByEmail ? 'yes' : 'no',
      userByEmail?.id
    )

    if (userByEmail) {
      throw new Error(
        `User exists with email ${invitation.email} but session user ID (${userId}) doesn't match database ID (${userByEmail.id}). Please try logging out and logging back in.`
      )
    }

    throw new Error('User not found. Please make sure you are logged in.')
  }

  // Check if email matches
  if (user.email !== invitation.email) {
    throw new Error(
      `This invitation was sent to ${invitation.email}. Please sign in with that email address to accept the invitation. You are currently signed in as ${user.email}.`
    )
  }

  // Add member and update invitation in a transaction
  const result = await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      },
    }),
    prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    }),
    prisma.organization.update({
      where: { id: invitation.organizationId },
      data: {
        seatsUsed: {
          increment: 1,
        },
      },
    }),
  ])

  // Send welcome email
  const welcomeEmail = getMemberAddedEmail(
    user.name || user.email,
    invitation.organization.name
  )
  await sendEmail({
    to: user.email,
    subject: welcomeEmail.subject,
    html: welcomeEmail.html,
  })

  return result[0]
}

export async function removeMemberFromOrganization(
  organizationId: string,
  memberId: string
) {
  const member = await prisma.organizationMember.findUnique({
    where: { id: memberId },
    include: { organization: true },
  })

  if (!member) {
    throw new Error('Member not found')
  }

  if (member.role === 'OWNER') {
    throw new Error('Cannot remove owner from organization')
  }

  // Remove member and decrement seats in a transaction
  await prisma.$transaction([
    prisma.organizationMember.delete({
      where: { id: memberId },
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        seatsUsed: {
          decrement: 1,
        },
      },
    }),
  ])

  return { success: true }
}

export async function updateMemberRole(
  memberId: string,
  newRole: 'ADMIN' | 'MEMBER' | 'VIEWER'
) {
  const member = await prisma.organizationMember.findUnique({
    where: { id: memberId },
  })

  if (!member) {
    throw new Error('Member not found')
  }

  if (member.role === 'OWNER') {
    throw new Error('Cannot change owner role')
  }

  const updatedMember = await prisma.organizationMember.update({
    where: { id: memberId },
    data: { role: newRole },
  })

  return updatedMember
}

export async function getOrganizationsByUserId(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              members: true,
              collections: true,
            },
          },
        },
      },
    },
  })

  return memberships.map((m) => ({
    ...m.organization,
    role: m.role,
    joinedAt: m.joinedAt,
  }))
}

export async function checkUserPermission(
  userId: string,
  organizationId: string,
  requiredRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
) {
  const member = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
    },
  })

  if (!member) {
    return false
  }

  const roleHierarchy = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 }
  return roleHierarchy[member.role] >= roleHierarchy[requiredRole]
}
