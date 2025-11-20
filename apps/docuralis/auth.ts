import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import AzureAD from 'next-auth/providers/azure-ad'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // OAuth providers (optional - only enabled if env vars are set)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    ...(process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
      ? [
          AzureAD({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
          }),
        ]
      : []),
    // Credentials provider (always enabled)
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth sign-ins, link account to existing user if email matches
      if (account && account.provider !== 'credentials' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        })

        if (existingUser) {
          // Update profile image if it's from OAuth and not already set
          if (user.image && !existingUser.image) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { image: user.image, name: user.name || existingUser.name },
            })
          }

          // Check if this OAuth account is already linked
          const accountExists = existingUser.accounts.find(
            (acc: { provider: string; providerAccountId: string }) =>
              acc.provider === account.provider &&
              acc.providerAccountId === account.providerAccountId
          )

          if (!accountExists) {
            // Link the OAuth account to the existing user
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state:
                  typeof account.session_state === 'string'
                    ? account.session_state
                    : null,
              },
            })
          }
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user && token.id) {
        session.user.id = token.id as string

        // Fetch latest user data including plan info and admin status
        const user = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            planType: true,
            planStatus: true,
            storageUsed: true,
            storageLimit: true,
            isSystemAdmin: true,
          },
        })

        if (user) {
          session.user.planType = user.planType
          session.user.planStatus = user.planStatus
          session.user.storageUsed = user.storageUsed.toString()
          session.user.storageLimit = user.storageLimit.toString()
          session.user.isSystemAdmin = user.isSystemAdmin
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})
