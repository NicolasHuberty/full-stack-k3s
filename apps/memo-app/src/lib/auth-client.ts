import { createAuthClient } from "better-auth/react";
import { twoFactorClient, oneTapClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    twoFactorClient(),
    oneTapClient({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      autoSelect: false,
      cancelOnTapOutside: true,
      context: "signin",
    }),
  ],
});

export const { signIn, signUp, signOut, useSession, oneTap } = authClient;

// Two-factor authentication functions
export const enable2FA = authClient.twoFactor.enable;
export const disable2FA = authClient.twoFactor.disable;
export const verify2FA = authClient.twoFactor.verifyTotp;
