import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor, oneTap } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const globalForAuth = globalThis as unknown as {
  auth: ReturnType<typeof betterAuth> | undefined;
};

export const auth =
  globalForAuth.auth ??
  betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-at-least-32-characters-long",
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        enabled: !!process.env.GOOGLE_CLIENT_ID,
      },
      github: {
        clientId: process.env.GITHUB_ID || "",
        clientSecret: process.env.GITHUB_SECRET || "",
        enabled: !!process.env.GITHUB_ID,
      },
      microsoft: {
        clientId: process.env.AZURE_AD_CLIENT_ID || "",
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
        tenantId: process.env.AZURE_AD_TENANT_ID || "common",
        enabled: !!process.env.AZURE_AD_CLIENT_ID,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true, // Enable email verification
      autoSignInAfterVerification: true, // Auto sign-in after email verification
      sendResetPassword: async ({ user, url, token }) => {
        // Send password reset email with code
        console.log(`[Auth] Sending password reset email to ${user.email}`);
        console.log(`[Auth] Reset URL: ${url}`);
        console.log(`[Auth] Reset token: ${token}`);
        await sendEmail({
          to: user.email,
          subject: "Reset your password - Memo App",
          html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .code { background-color: #fff; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border: 2px dashed #EF4444; }
    .button { background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Hi ${user.name},</p>
      <p>We received a request to reset your password. Use the code below or click the link to reset your password:</p>
      <div class="code">${token}</div>
      <p style="text-align: center;">
        <a href="${url}" class="button">Reset Password</a>
      </p>
      <p style="font-size: 12px; color: #6b7280;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Memo App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
          `,
        });
      },
    },
    plugins: [
      twoFactor({
        issuer: "Memo App",
        otpOptions: {
          // Allow email OTP as backup when TOTP not available
          sendOTP: async ({ user, otp }) => {
            await sendEmail({
              to: user.email,
              subject: "Your verification code - Memo App",
              html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .code { background-color: #fff; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border: 2px dashed #10b981; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔑 Your Verification Code</h1>
    </div>
    <div class="content">
      <p>Hi ${user.name},</p>
      <p>Your verification code is:</p>
      <div class="code">${otp}</div>
      <p>This code will expire in 10 minutes.</p>
      <p style="font-size: 12px; color: #6b7280;">If you didn't request this code, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Memo App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
              `,
            });
          },
        },
      }),
      oneTap(),
    ],
    emailVerification: {
      sendVerificationEmail: async ({ user, url, token }) => {
        console.log(`[Auth] Sending verification email to ${user.email}`);
        console.log(`[Auth] Verification URL: ${url}`);
        console.log(`[Auth] Verification token: ${token}`);
        await sendEmail({
          to: user.email,
          subject: "Verify your email - Memo App",
          html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .code { background-color: #fff; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border: 2px dashed #4F46E5; }
    .button { background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 Verify Your Email</h1>
    </div>
    <div class="content">
      <p>Hi ${user.name},</p>
      <p>Thank you for signing up for Memo App! Please verify your email address by clicking the link below or using the verification code:</p>
      <div class="code">${token}</div>
      <p style="text-align: center;">
        <a href="${url}" class="button">Verify Email Address</a>
      </p>
      <p style="font-size: 12px; color: #6b7280;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Memo App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
          `,
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 365, // 1 year for mobile apps
      updateAge: 60 * 60 * 24 * 7, // Update session every 7 days
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // Cache session for 5 minutes
      },
    },
    // Advanced session configuration for iOS
    advanced: {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      },
      // Enable refresh tokens for mobile apps
      useRefreshTokens: true,
      refreshTokenExpiresIn: 60 * 60 * 24 * 365 * 10, // 10 years for iOS
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForAuth.auth = auth;
}

export type Session = typeof auth.$Infer.Session;
