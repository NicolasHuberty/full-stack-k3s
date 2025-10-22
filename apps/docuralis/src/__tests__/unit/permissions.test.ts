import { hasCollectionAccess } from '@/lib/collections/permissions'
import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    collection: {
      findUnique: jest.fn(),
    },
    organizationMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

describe('Permission System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('hasCollectionAccess', () => {
    const userId = 'user-123'
    const collectionId = 'collection-123'

    it('should grant access to collection owner', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        id: collectionId,
        ownerId: userId,
        visibility: 'PRIVATE',
        organization: null,
        permissions: [],
      })

      const hasAccess = await hasCollectionAccess(userId, collectionId, 'read')

      expect(hasAccess).toBe(true)
    })

    it('should grant read access to public collections', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        id: collectionId,
        ownerId: 'other-user',
        visibility: 'PUBLIC',
        organization: null,
        permissions: [],
      })

      const hasAccess = await hasCollectionAccess(userId, collectionId, 'read')

      expect(hasAccess).toBe(true)
    })

    it('should deny write access to public collections without permission', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        id: collectionId,
        ownerId: 'other-user',
        visibility: 'PUBLIC',
        organization: null,
        permissions: [],
      })

      const hasAccess = await hasCollectionAccess(userId, collectionId, 'write')

      expect(hasAccess).toBe(false)
    })

    it('should grant access based on explicit permissions', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        id: collectionId,
        ownerId: 'other-user',
        visibility: 'PRIVATE',
        organization: null,
        permissions: [
          {
            userId,
            permission: 'EDITOR',
          },
        ],
      })

      const hasAccess = await hasCollectionAccess(userId, collectionId, 'write')

      expect(hasAccess).toBe(true)
    })

    it('should deny access without permission', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        id: collectionId,
        ownerId: 'other-user',
        visibility: 'PRIVATE',
        organization: null,
        permissions: [],
      })

      const hasAccess = await hasCollectionAccess(userId, collectionId, 'read')

      expect(hasAccess).toBe(false)
    })

    it('should return false if collection not found', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue(null)

      const hasAccess = await hasCollectionAccess(userId, collectionId, 'read')

      expect(hasAccess).toBe(false)
    })

    it('should grant access to org admins', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        id: collectionId,
        ownerId: 'other-user',
        visibility: 'ORGANIZATION',
        organizationId: 'org-123',
        organization: {
          id: 'org-123',
          members: [
            {
              userId,
              role: 'ADMIN',
              isActive: true,
            },
          ],
        },
        permissions: [],
      })

      const hasAccess = await hasCollectionAccess(userId, collectionId, 'write')

      expect(hasAccess).toBe(true)
    })

    it('should handle VIEWER permissions correctly', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        id: collectionId,
        ownerId: 'other-user',
        visibility: 'PRIVATE',
        organization: null,
        permissions: [
          {
            userId,
            permission: 'VIEWER',
          },
        ],
      })

      const canRead = await hasCollectionAccess(userId, collectionId, 'read')
      const canWrite = await hasCollectionAccess(userId, collectionId, 'write')

      expect(canRead).toBe(true)
      expect(canWrite).toBe(false)
    })

    it('should handle ADMIN permissions correctly', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        id: collectionId,
        ownerId: 'other-user',
        visibility: 'PRIVATE',
        organization: null,
        permissions: [
          {
            userId,
            permission: 'ADMIN',
          },
        ],
      })

      const canRead = await hasCollectionAccess(userId, collectionId, 'read')
      const canWrite = await hasCollectionAccess(userId, collectionId, 'write')
      const canDelete = await hasCollectionAccess(userId, collectionId, 'delete')
      const canManage = await hasCollectionAccess(userId, collectionId, 'manage')

      expect(canRead).toBe(true)
      expect(canWrite).toBe(true)
      expect(canDelete).toBe(true)
      expect(canManage).toBe(true)
    })
  })
})
