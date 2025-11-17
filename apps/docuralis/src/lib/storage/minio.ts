import * as Minio from 'minio'
import { Readable } from 'stream'

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'docuralis'

class MinIOClient {
  private client: Minio.Client
  private bucketName: string

  constructor() {
    const useSSL = process.env.MINIO_USE_SSL === 'true'
    const port = parseInt(process.env.MINIO_PORT || (useSSL ? '443' : '9000'))

    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: port,
      useSSL: useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      // For MinIO behind reverse proxy/CDN
      pathStyle: true,
    })
    this.bucketName = BUCKET_NAME
  }

  async initialize(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName)
      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1')
        console.log(`Bucket ${this.bucketName} created successfully`)
      }
    } catch (error) {
      console.error('Failed to initialize MinIO bucket:', error)
      throw error
    }
  }

  async uploadFile(
    filename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    try {
      await this.initialize()

      const metadata = {
        'Content-Type': mimeType,
      }

      await this.client.putObject(
        this.bucketName,
        filename,
        buffer,
        buffer.length,
        metadata
      )

      // Return the file URL
      const url = `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${this.bucketName}/${filename}`
      return url
    } catch (error) {
      console.error('Failed to upload file to MinIO:', error)
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async uploadStream(
    filename: string,
    stream: Readable,
    size: number,
    mimeType: string
  ): Promise<string> {
    try {
      await this.initialize()

      const metadata = {
        'Content-Type': mimeType,
      }

      await this.client.putObject(
        this.bucketName,
        filename,
        stream,
        size,
        metadata
      )

      const url = `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${this.bucketName}/${filename}`
      return url
    } catch (error) {
      console.error('Failed to upload stream to MinIO:', error)
      throw new Error(
        `Failed to upload stream: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async downloadFile(filename: string): Promise<Buffer> {
    try {
      const stream = await this.getObject(this.bucketName, filename)
      const chunks: Buffer[] = []

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
      })
    } catch (error) {
      console.error('Failed to download file from MinIO:', error)
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getObject(bucketName: string, filename: string) {
    try {
      return await this.client.getObject(bucketName, filename)
    } catch (error) {
      console.error('Failed to get object from MinIO:', error)
      throw new Error(
        `Failed to get object: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, filename)
    } catch (error) {
      console.error('Failed to delete file from MinIO:', error)
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async deleteFiles(filenames: string[]): Promise<void> {
    try {
      await this.client.removeObjects(this.bucketName, filenames)
    } catch (error) {
      console.error('Failed to delete files from MinIO:', error)
      throw new Error(
        `Failed to delete files: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getFileUrl(
    filename: string,
    expirySeconds: number = 3600
  ): Promise<string> {
    try {
      const url = await this.client.presignedGetObject(
        this.bucketName,
        filename,
        expirySeconds
      )
      return url
    } catch (error) {
      console.error('Failed to generate presigned URL:', error)
      throw new Error(
        `Failed to generate URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucketName, filename)
      return true
    } catch {
      return false
    }
  }

  async listObjects(prefix: string = '', recursive: boolean = false) {
    return this.client.listObjects(this.bucketName, prefix, recursive)
  }

  async findFileByName(filename: string): Promise<string | null> {
    try {
      const objectStream = this.client.listObjects(this.bucketName, '', true)

      for await (const obj of objectStream) {
        if (obj.name?.endsWith(filename)) {
          return obj.name
        }
      }

      return null
    } catch (error) {
      console.error('Failed to search for file:', error)
      return null
    }
  }

  async downloadFileByName(
    filename: string,
    collectionId?: string
  ): Promise<Buffer> {
    try {
      // First try with collection prefix if provided
      if (collectionId) {
        const fullPath = `${collectionId}/${filename}`
        if (await this.fileExists(fullPath)) {
          return await this.downloadFile(fullPath)
        }
      }

      // Try finding the file by searching
      const foundPath = await this.findFileByName(filename)
      if (!foundPath) {
        throw new Error(`File not found: ${filename}`)
      }

      return await this.downloadFile(foundPath)
    } catch (error) {
      console.error('Failed to download file by name:', error)
      throw new Error(
        `Failed to download file by name: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}

// Singleton instance
let minioClient: MinIOClient | null = null

export function getMinIOClient(): MinIOClient {
  if (!minioClient) {
    minioClient = new MinIOClient()
  }
  return minioClient
}

// Alias for compatibility
export const getMinioClient = getMinIOClient

export type { MinIOClient }
