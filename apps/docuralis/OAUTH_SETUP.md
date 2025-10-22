# OAuth Setup Guide

This guide will help you set up OAuth authentication with Google, GitHub, and Microsoft.

## Prerequisites

- A running Next.js application (http://localhost:3001)
- Access to provider developer consoles

## Callback URLs

All OAuth providers will redirect back to:

```
http://localhost:3001/api/auth/callback/{provider}
```

**For production, use:**

```
https://yourdomain.com/api/auth/callback/{provider}
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure OAuth consent screen if not done:
   - User Type: External (for testing)
   - Add app name, user support email, developer contact
   - Add scopes: `email`, `profile`
6. Create OAuth Client:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3001/api/auth/callback/google`
7. Copy **Client ID** and **Client Secret** to `.env.local`:
   ```env
   GOOGLE_CLIENT_ID="your-client-id"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

---

## GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - Application name: `Docuralis Dev`
   - Homepage URL: `http://localhost:3001`
   - Authorization callback URL: `http://localhost:3001/api/auth/callback/github`
4. Click **Register application**
5. Generate a new client secret
6. Copy **Client ID** and **Client Secret** to `.env.local`:
   ```env
   GITHUB_ID="your-client-id"
   GITHUB_SECRET="your-client-secret"
   ```

---

## Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in:
   - Name: `Docuralis Dev`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: `Web` → `http://localhost:3001/api/auth/callback/microsoft`
5. Click **Register**
6. In **Overview**, copy **Application (client) ID**:
   ```env
   AZURE_AD_CLIENT_ID="your-application-id"
   ```
7. Go to **Certificates & secrets** → **New client secret**
8. Add description, choose expiration, click **Add**
9. Copy the **Value** (not Secret ID):
   ```env
   AZURE_AD_CLIENT_SECRET="your-client-secret-value"
   ```
10. In **Overview**, copy the **Directory (tenant) ID**:

```env
AZURE_AD_TENANT_ID="common"  # or your specific tenant ID
```

- Use `"common"` for multi-tenant (personal + work accounts)
- Use your tenant ID for single-tenant

11. Go to **API permissions**:
    - Add permission → **Microsoft Graph** → **Delegated permissions**
    - Add: `email`, `openid`, `profile`
    - Click **Grant admin consent** (if applicable)

---

## Testing

1. Restart your dev server:

   ```bash
   bun run dev
   ```

2. Navigate to:
   - Login: http://localhost:3001/login
   - Register: http://localhost:3001/register

3. Try signing in with each provider

---

## Production Deployment

When deploying to production:

1. Update OAuth callback URLs in each provider:

   ```
   https://yourdomain.com/api/auth/callback/{provider}
   ```

2. Add production environment variables to your hosting platform

3. Update `AUTH_URL` in `.env`:
   ```env
   AUTH_URL="https://yourdomain.com"
   ```

---

## Troubleshooting

### "redirect_uri_mismatch" error

- Verify callback URLs match exactly in provider settings
- Check for trailing slashes
- Ensure protocol matches (http vs https)

### "invalid_client" error

- Double-check client ID and secret
- Ensure no extra spaces in .env.local
- Restart dev server after changing .env.local

### User not created in database

- Check database connection
- Verify Prisma migrations are up to date: `bunx prisma migrate dev`
- Check server logs for errors

---

## Optional: Make Providers Optional

To make OAuth providers optional (for development), update `auth.ts`:

```typescript
providers: [
  ...(process.env.GOOGLE_CLIENT_ID
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : []),
  // Repeat for other providers
]
```
