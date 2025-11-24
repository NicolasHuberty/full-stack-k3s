import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || process.env.ENCRYPTION_KEY
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or ENCRYPTION_KEY must be set')
  }
  // Ensure the key is 32 bytes for aes-256
  return createHash('sha256').update(secret).digest()
}

export function encrypt(text: string): string {
  if (!text) return text

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(text: string): string {
  if (!text) return text

  // Check if text is in valid format (iv:authTag:encrypted)
  const parts = text.split(':')
  if (parts.length !== 3) {
    // Fallback: return as is if it doesn't look encrypted (legacy keys)
    // This allows existing keys to work until they are re-saved
    return text
  }

  try {
    const key = getEncryptionKey()
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encryptedText = parts[2]

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.warn('Failed to decrypt text, returning original:', error)
    return text
  }
}
