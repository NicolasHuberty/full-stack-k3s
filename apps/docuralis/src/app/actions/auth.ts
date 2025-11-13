'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signIn } from '@/auth'
import { AuthError } from 'next-auth'

export async function register(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const language = (formData.get('language') as string) || 'en'

  // Validation
  if (!name || !email || !password) {
    return { error: 'All fields are required' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: 'User with this email already exists' }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create user
  try {
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        language,
        planType: 'FREE',
        planStatus: 'TRIAL',
        planStartDate: new Date(),
        planEndDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), // 31 days trial
      },
    })

    console.log('User created successfully:', {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    })

    // Verify user exists by querying it back
    const verifyUser = await prisma.user.findUnique({
      where: { id: newUser.id },
    })
    console.log(
      'User verification query result:',
      verifyUser ? 'FOUND' : 'NOT FOUND'
    )

    // Auto sign in after registration
    const signInResult = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    console.log('Sign in after registration result:', signInResult)

    return { success: true }
  } catch (error) {
    console.error('Registration error:', error)
    return { error: 'Failed to create account' }
  }
}

export async function loginWithCredentials(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password' }
        default:
          return { error: 'Something went wrong' }
      }
    }
    throw error
  }
}
