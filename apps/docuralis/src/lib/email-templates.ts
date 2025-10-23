import { getEmailLayout } from './email'

export function getWelcomeEmail(name: string) {
  const content = `
    <h2 style="color: #0A2540; margin-bottom: 20px;">Welcome to Docuralis! 🎉</h2>
    <p>Hi ${name},</p>
    <p>We're excited to have you on board! Docuralis is your AI-powered document assistant that transforms your documents into intelligent knowledge.</p>

    <h3 style="color: #0A2540; margin-top: 30px;">Get Started</h3>
    <ul style="line-height: 2;">
      <li>Upload your first document</li>
      <li>Create collections to organize your knowledge</li>
      <li>Chat with AI agents about your documents</li>
    </ul>

    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/dashboard" class="button">
      Go to Dashboard
    </a>

    <p style="margin-top: 30px;">If you have any questions, feel free to reach out to our support team.</p>
    <p>Best regards,<br>The Docuralis Team</p>
  `

  return {
    subject: 'Welcome to Docuralis!',
    html: getEmailLayout(content),
  }
}

export function getLoginNotificationEmail(
  name: string,
  ipAddress?: string,
  location?: string
) {
  const content = `
    <h2 style="color: #0A2540; margin-bottom: 20px;">New Login Detected 🔐</h2>
    <p>Hi ${name},</p>
    <p>We detected a new login to your Docuralis account.</p>

    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 8px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      ${ipAddress ? `<p style="margin: 8px 0;"><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
      ${location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${location}</p>` : ''}
    </div>

    <p>If this was you, you can safely ignore this email.</p>
    <p style="color: #dc2626; font-weight: 600;">If you didn't log in, please secure your account immediately:</p>

    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/settings/security" class="button">
      Secure My Account
    </a>

    <p style="margin-top: 30px;">Best regards,<br>The Docuralis Team</p>
  `

  return {
    subject: 'New Login to Your Docuralis Account',
    html: getEmailLayout(content),
  }
}

export function getOrganizationInvitationEmail(
  inviteeName: string,
  organizationName: string,
  inviterName: string,
  inviteToken: string,
  role: string
) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/invite/${inviteToken}`

  const content = `
    <h2 style="color: #0A2540; margin-bottom: 20px;">You've Been Invited! 🎉</h2>
    <p>Hi ${inviteeName},</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Docuralis.</p>

    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 8px 0;"><strong>Organization:</strong> ${organizationName}</p>
      <p style="margin: 8px 0;"><strong>Role:</strong> ${role}</p>
      <p style="margin: 8px 0;"><strong>Invited by:</strong> ${inviterName}</p>
    </div>

    <p>As a ${role}, you'll be able to collaborate with your team and access shared document collections.</p>

    <a href="${inviteUrl}" class="button">
      Accept Invitation
    </a>

    <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
      This invitation will expire in 7 days. If you don't want to join, you can safely ignore this email.
    </p>

    <p style="margin-top: 30px;">Best regards,<br>The Docuralis Team</p>
  `

  return {
    subject: `You've been invited to join ${organizationName} on Docuralis`,
    html: getEmailLayout(content),
  }
}

export function getMemberAddedEmail(
  userName: string,
  organizationName: string
) {
  const content = `
    <h2 style="color: #0A2540; margin-bottom: 20px;">Welcome to ${organizationName}! 🎉</h2>
    <p>Hi ${userName},</p>
    <p>Your invitation to join <strong>${organizationName}</strong> has been accepted!</p>

    <p>You now have access to:</p>
    <ul style="line-height: 2;">
      <li>Shared document collections</li>
      <li>Team AI agents</li>
      <li>Collaborative workspaces</li>
      <li>Organization storage</li>
    </ul>

    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/dashboard" class="button">
      Go to Dashboard
    </a>

    <p style="margin-top: 30px;">Best regards,<br>The Docuralis Team</p>
  `

  return {
    subject: `Welcome to ${organizationName} on Docuralis`,
    html: getEmailLayout(content),
  }
}

export function getPasswordResetEmail(name: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/reset-password/${resetToken}`

  const content = `
    <h2 style="color: #0A2540; margin-bottom: 20px;">Reset Your Password 🔑</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password for your Docuralis account.</p>

    <p>Click the button below to create a new password:</p>

    <a href="${resetUrl}" class="button">
      Reset Password
    </a>

    <p style="margin-top: 30px; color: #dc2626; font-weight: 600;">
      If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
    </p>

    <p style="font-size: 14px; color: #6b7280;">
      This link will expire in 1 hour for security reasons.
    </p>

    <p style="margin-top: 30px;">Best regards,<br>The Docuralis Team</p>
  `

  return {
    subject: 'Reset Your Docuralis Password',
    html: getEmailLayout(content),
  }
}

export function getSeatLimitEmail(
  adminName: string,
  organizationName: string,
  seatsUsed: number,
  seatsTotal: number
) {
  const content = `
    <h2 style="color: #0A2540; margin-bottom: 20px;">Seat Limit Reached ⚠️</h2>
    <p>Hi ${adminName},</p>
    <p>Your organization <strong>${organizationName}</strong> has reached its seat limit.</p>

    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 8px 0;"><strong>Current Usage:</strong> ${seatsUsed} / ${seatsTotal} seats</p>
    </div>

    <p>You won't be able to invite new members until you:</p>
    <ul style="line-height: 2;">
      <li>Upgrade your plan to get more seats</li>
      <li>Remove inactive members</li>
    </ul>

    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/settings/billing" class="button">
      Upgrade Plan
    </a>

    <p style="margin-top: 30px;">Best regards,<br>The Docuralis Team</p>
  `

  return {
    subject: `${organizationName} has reached its seat limit`,
    html: getEmailLayout(content),
  }
}

export function getTrialEndingEmail(
  adminName: string,
  organizationName: string,
  daysLeft: number
) {
  const content = `
    <h2 style="color: #0A2540; margin-bottom: 20px;">Your Trial is Ending Soon ⏰</h2>
    <p>Hi ${adminName},</p>
    <p>Your Docuralis trial for <strong>${organizationName}</strong> will end in <strong>${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}</strong>.</p>

    <p>To continue using Docuralis without interruption, please upgrade to a paid plan.</p>

    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00C49A;">
      <h3 style="margin-top: 0;">What happens after trial ends?</h3>
      <p style="margin-bottom: 0;">Your account will be downgraded to the Free plan with limited features and storage.</p>
    </div>

    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/settings/billing" class="button">
      Upgrade Now
    </a>

    <p style="margin-top: 30px;">Best regards,<br>The Docuralis Team</p>
  `

  return {
    subject: `Your Docuralis trial ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
    html: getEmailLayout(content),
  }
}
