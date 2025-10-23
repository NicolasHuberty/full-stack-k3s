/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma'
import { getQdrantClient } from '@/lib/vector/qdrant'
import { CollectionVisibility, CollectionPermissionLevel } from '@prisma/client'
import { hasCollectionAccess, canCreateOrgCollection } from './permissions'

export interface CreateCollectionInput {
  name: string
  description?: string
  visibility?: CollectionVisibility
  allowPublicRead?: boolean
  organizationId?: string
  ownerId: string
  embeddingModel?: string
  chunkSize?: number
  chunkOverlap?: number
}

export interface UpdateCollectionInput {
  name?: string
  description?: string
  visibility?: CollectionVisibility
  allowPublicRead?: boolean
  embeddingModel?: string
  chunkSize?: number
  chunkOverlap?: number
}

/**
 * Create a new collection
 */
export async function createCollection(input: CreateCollectionInput) {
  try {
    // If organizationId is provided, check permission
    if (input.organizationId) {
      const canCreate = await canCreateOrgCollection(
        input.ownerId,
        input.organizationId
      )
      if (!canCreate) {
        throw new Error(
          'You do not have permission to create collections in this organization'
        )
      }
    }

    // Create collection in database
    const collection = await prisma.collection.create({
      data: {
        name: input.name,
        description: input.description,
        visibility: input.visibility || 'PRIVATE',
        allowPublicRead: input.allowPublicRead || false,
        organizationId: input.organizationId,
        ownerId: input.ownerId,
        embeddingModel: input.embeddingModel || 'text-embedding-3-small',
        chunkSize: input.chunkSize || 1000,
        chunkOverlap: input.chunkOverlap || 200,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    // Create Qdrant collection
    try {
      const qdrant = getQdrantClient()
      await qdrant.createCollection(
        collection.id,
        collection.embeddingModel as any
      )
    } catch (error) {
      console.error('Failed to create Qdrant collection:', error)
      // Don't fail the entire operation if Qdrant fails
      // The collection can be created later
    }

    return collection
  } catch (error) {
    console.error('Failed to create collection:', error)
    throw error
  }
}

/**
 * Get a collection by ID with permission check
 */
export async function getCollection(collectionId: string, userId: string) {
  try {
    const hasAccess = await hasCollectionAccess(userId, collectionId, 'read')
    if (!hasAccess) {
      throw new Error('You do not have access to this collection')
    }

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
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
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        tags: true,
        _count: {
          select: {
            documents: true,
          },
        },
      },
    })

    if (!collection) {
      throw new Error('Collection not found')
    }

    return collection
  } catch (error) {
    console.error('Failed to get collection:', error)
    throw error
  }
}

/**
 * Update a collection
 */
export async function updateCollection(
  collectionId: string,
  userId: string,
  input: UpdateCollectionInput
) {
  try {
    const hasAccess = await hasCollectionAccess(userId, collectionId, 'manage')
    if (!hasAccess) {
      throw new Error('You do not have permission to update this collection')
    }

    const collection = await prisma.collection.update({
      where: { id: collectionId },
      data: input,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    return collection
  } catch (error) {
    console.error('Failed to update collection:', error)
    throw error
  }
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId: string, userId: string) {
  try {
    const hasAccess = await hasCollectionAccess(userId, collectionId, 'delete')
    if (!hasAccess) {
      throw new Error('You do not have permission to delete this collection')
    }

    // Delete from Qdrant first
    try {
      const qdrant = getQdrantClient()
      await qdrant.deleteCollection(collectionId)
    } catch (error) {
      console.error('Failed to delete Qdrant collection:', error)
      // Continue with database deletion even if Qdrant fails
    }

    // Delete from database (cascades to documents, chunks, permissions, etc.)
    await prisma.collection.delete({
      where: { id: collectionId },
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to delete collection:', error)
    throw error
  }
}

/**
 * Get collection statistics
 */
export async function getCollectionStats(collectionId: string, userId: string) {
  try {
    const hasAccess = await hasCollectionAccess(userId, collectionId, 'read')
    if (!hasAccess) {
      throw new Error('You do not have access to this collection')
    }

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        _count: {
          select: {
            documents: true,
            permissions: true,
            tags: true,
            chatSessions: true,
          },
        },
        documents: {
          select: {
            status: true,
            totalChunks: true,
          },
        },
      },
    })

    if (!collection) {
      throw new Error('Collection not found')
    }

    // Calculate statistics
    const totalChunks = collection.documents.reduce(
      (sum, doc) => sum + doc.totalChunks,
      0
    )

    const documentsByStatus = {
      pending: collection.documents.filter((d) => d.status === 'PENDING')
        .length,
      processing: collection.documents.filter((d) => d.status === 'PROCESSING')
        .length,
      completed: collection.documents.filter((d) => d.status === 'COMPLETED')
        .length,
      failed: collection.documents.filter((d) => d.status === 'FAILED').length,
    }

    return {
      documentCount: collection._count.documents,
      totalChunks,
      storageUsed: collection.storageUsed.toString(),
      permissionsCount: collection._count.permissions,
      tagsCount: collection._count.tags,
      chatSessionsCount: collection._count.chatSessions,
      documentsByStatus,
    }
  } catch (error) {
    console.error('Failed to get collection stats:', error)
    throw error
  }
}

/**
 * Add a tag to a collection
 */
export async function addCollectionTag(
  collectionId: string,
  userId: string,
  tagName: string,
  color?: string
) {
  try {
    const hasAccess = await hasCollectionAccess(userId, collectionId, 'write')
    if (!hasAccess) {
      throw new Error(
        'You do not have permission to add tags to this collection'
      )
    }

    const tag = await prisma.collectionTag.create({
      data: {
        name: tagName,
        color,
        collectionId,
      },
    })

    return tag
  } catch (error) {
    console.error('Failed to add collection tag:', error)
    throw error
  }
}

/**
 * Delete a tag from a collection
 */
export async function deleteCollectionTag(tagId: string, userId: string) {
  try {
    const tag = await prisma.collectionTag.findUnique({
      where: { id: tagId },
      include: {
        collection: true,
      },
    })

    if (!tag) {
      throw new Error('Tag not found')
    }

    const hasAccess = await hasCollectionAccess(
      userId,
      tag.collectionId,
      'write'
    )
    if (!hasAccess) {
      throw new Error('You do not have permission to delete this tag')
    }

    await prisma.collectionTag.delete({
      where: { id: tagId },
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to delete collection tag:', error)
    throw error
  }
}
