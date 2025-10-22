import { prisma } from '@/lib/prisma'
import { sendEmail } from './email'
import { getOrganizationInvitationEmail, getMemberAddedEmail } from './email-templates'
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

  // Send invitation email
  const emailContent = getOrganizationInvitationEmail(
    data.email,
    invitation.organization.name,
    invitation.invitedBy?.name || 'A team member',
    token,
    data.role
  )

  await sendEmail({
    to: data.email,
    subject: emailContent.subject,
    html: emailContent.html,
  })

  return invitation
}

export async function acceptInvitation(token: string, userId: string) {
  // Find invitation
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: { organization: true },
  })

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Check if email matches
  if (user.email !== invitation.email) {
    throw new Error('Email does not match invitation')
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
  const welcomeEmail = getMemberAddedEmail(user.name || user.email, invitation.organization.name)
  await sendEmail({
    to: user.email,
    subject: welcomeEmail.subject,
    html: welcomeEmail.html,
  })

  return result[0]
}

export async function removeMemberFromOrganization(organizationId: string, memberId: string) {
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

export async function updateMemberRole(memberId: string, newRole: 'ADMIN' | 'MEMBER' | 'VIEWER') {
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
