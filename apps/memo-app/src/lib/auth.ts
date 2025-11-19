import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      language: {
        type: "string",
        defaultValue: "en",
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to false for easier testing, true for production
    sendVerificationEmail: async ({ user, url, token }: any) => {
      await sendVerificationEmail(user.email, token);
    },
    sendResetPassword: async ({ user, url, token }: any) => {
      await sendPasswordResetEmail(user.email, token);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }: any) => {
      await sendVerificationEmail(user.email, token);
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
    // Map NextAuth field names to Better Auth expected names
    fields: {
      accountId: "providerAccountId",
      providerId: "provider",
      refreshToken: "refresh_token",
      accessToken: "access_token",
      idToken: "id_token",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
});

export type AuthSession = typeof auth.$Infer.Session;
