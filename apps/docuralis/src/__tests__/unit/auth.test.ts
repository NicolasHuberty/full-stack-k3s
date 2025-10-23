import bcrypt from 'bcryptjs'

describe('Authentication Unit Tests', () => {
  describe('Password Hashing', () => {
    it('should hash a password correctly', async () => {
      const password = 'testpassword123'
      const hashedPassword = await bcrypt.hash(password, 10)

      expect(hashedPassword).toBeDefined()
      expect(hashedPassword).not.toBe(password)
      expect(hashedPassword.length).toBeGreaterThan(0)
    })

    it('should verify correct password', async () => {
      const password = 'testpassword123'
      const hashedPassword = await bcrypt.hash(password, 10)
      const isValid = await bcrypt.compare(password, hashedPassword)

      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'testpassword123'
      const wrongPassword = 'wrongpassword'
      const hashedPassword = await bcrypt.hash(password, 10)
      const isValid = await bcrypt.compare(wrongPassword, hashedPassword)

      expect(isValid).toBe(false)
    })
  })

  describe('Email Validation', () => {
    it('should validate correct email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test+filter@example.com',
      ]

      validEmails.forEach((email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        expect(emailRegex.test(email)).toBe(true)
      })
    })

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'test@',
        'test @example.com',
      ]

      invalidEmails.forEach((email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        expect(emailRegex.test(email)).toBe(false)
      })
    })
  })
})
