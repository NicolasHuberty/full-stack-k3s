import { prisma } from '@/lib/prisma'
import { CollectionPermissionLevel } from '@prisma/client'

export type Permission = 'read' | 'write' | 'delete' | 'manage'

/**
 * Check if a user has access to a collection
 */
export async function hasCollectionAccess(
  userId: string,
  collectionId: string,
  requiredPermission: Permission = 'read'
): Promise<boolean> {
  try {
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        owner: true,
        organization: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        permissions: {
          where: { userId },
        },
      },
    })

    if (!collection) {
      return false
    }

    // Owner has full access
    if (collection.ownerId === userId) {
      return true
    }

    // PUBLIC collections: anyone can read
    if (collection.visibility === 'PUBLIC' && requiredPermission === 'read') {
      return true
    }

    // ORGANIZATION collections: organization members can read if allowPublicRead is true
    if (
      collection.visibility === 'ORGANIZATION' &&
      collection.organizationId &&
      requiredPermission === 'read'
    ) {
      const isMember = collection.organization?.members.some(
        (m) => m.userId === userId
      )
      if (isMember && collection.allowPublicRead) {
        return true
      }
    }

    // Check explicit permissions
    const userPermission = collection.permissions.find(
      (p) => p.userId === userId
    )
    if (userPermission) {
      return hasPermissionLevel(userPermission.permission, requiredPermission)
    }

    // Organization admins/owners have full access to org collections
    if (collection.organizationId) {
      const member = collection.organization?.members.find(
        (m) => m.userId === userId
      )
      if (member && (member.role === 'OWNER' || member.role === 'ADMIN')) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Failed to check collection access:', error)
    return false
  }
}

/**
 * Check if a permission level satisfies a required permission
 */
function hasPermissionLevel(
  userLevel: CollectionPermissionLevel,
  required: Permission
): boolean {
  const levels: Record<CollectionPermissionLevel, Permission[]> = {
    VIEWER: ['read'],
    EDITOR: ['read', 'write'],
    ADMIN: ['read', 'write', 'delete', 'manage'],
  }

  return levels[userLevel]?.includes(required) || false
}

/**
 * Grant permission to a user for a collection
 */
export async function grantCollectionPermission(
  collectionId: string,
  userId: string,
  permission: CollectionPermissionLevel,
  grantedById: string
): Promise<void> {
  try {
    // Check if granter has manage permission
    const canManage = await hasCollectionAccess(
      grantedById,
      collectionId,
      'manage'
    )
    if (!canManage) {
      throw new Error('You do not have permission to manage this collection')
    }

    // Upsert permission
    await prisma.collectionPermission.upsert({
      where: {
        collectionId_userId: {
          collectionId,
          userId,
        },
      },
      update: {
        permission,
        grantedById,
      },
      create: {
        collectionId,
        userId,
        permission,
        grantedById,
      },
    })
  } catch (error) {
    console.error('Failed to grant collection permission:', error)
    throw error
  }
}

/**
 * Revoke permission from a user for a collection
 */
export async function revokeCollectionPermission(
  collectionId: string,
  userId: string,
  revokedById: string
): Promise<void> {
  try {
    // Check if revoker has manage permission
    const canManage = await hasCollectionAccess(
      revokedById,
      collectionId,
      'manage'
    )
    if (!canManage) {
      throw new Error('You do not have permission to manage this collection')
    }

    // Delete permission
    await prisma.collectionPermission.deleteMany({
      where: {
        collectionId,
        userId,
      },
    })
  } catch (error) {
    console.error('Failed to revoke collection permission:', error)
    throw error
  }
}

/**
 * Get all users with permissions for a collection
 */
export async function getCollectionPermissions(collectionId: string) {
  try {
    return await prisma.collectionPermission.findMany({
      where: { collectionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        grantedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  } catch (error) {
    console.error('Failed to get collection permissions:', error)
    throw error
  }
}

/**
 * Get all collections a user has access to
 */
export async function getUserCollections(userId: string) {
  try {
    // Get user's organizations
    const userOrgs = await prisma.organizationMember.findMany({
      where: { userId, isActive: true },
      select: { organizationId: true },
    })

    const orgIds = userOrgs.map((o) => o.organizationId)

    // Find all collections the user can access
    const collections = await prisma.collection.findMany({
      where: {
        OR: [
          // Own collections
          { ownerId: userId },
          // Collections with explicit permissions
          { permissions: { some: { userId } } },
          // Organization collections (if member)
          {
            organizationId: { in: orgIds },
            visibility: 'ORGANIZATION',
          },
          // Public collections
          { visibility: 'PUBLIC' },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        permissions: {
          where: { userId },
          select: {
            permission: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return collections
  } catch (error) {
    console.error('Failed to get user collections:', error)
    throw error
  }
}

/**
 * Check if user can create collection in organization
 */
export async function canCreateOrgCollection(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    })

    if (!member || !member.isActive) {
      return false
    }

    // OWNER, ADMIN, and MEMBER can create collections
    return ['OWNER', 'ADMIN', 'MEMBER'].includes(member.role)
  } catch (error) {
    console.error('Failed to check org collection creation permission:', error)
    return false
  }
}
