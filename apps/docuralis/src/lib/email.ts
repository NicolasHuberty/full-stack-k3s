import nodemailer from 'nodemailer'

// Create transporter with Hostinger SMTP
// Only create transporter if SMTP credentials are configured
const getTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn(
      '⚠️  SMTP credentials not configured. Email sending will fail.'
    )
    console.warn('   Set SMTP_USER and SMTP_PASSWORD environment variables.')
    return null
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // use SSL
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

const transporter = getTransporter()

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  // Skip email sending if SMTP is not configured
  if (!transporter) {
    const errorMsg =
      'SMTP transporter not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.'
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️  Email sending skipped (SMTP not configured):`)
      console.warn(`   To: ${to}`)
      console.warn(`   Subject: ${subject}`)
      return { success: false, error: errorMsg }
    }
    // In production, throw error
    throw new Error(errorMsg)
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Docuralis'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML as fallback
    })
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Failed to send email:', error)
    // Re-throw to allow caller to handle
    throw error
  }
}

// Email template helpers
export function getEmailLayout(content: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Docuralis</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background: linear-gradient(135deg, #0A2540 0%, #1a3a5a 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .email-logo {
      width: 60px;
      height: 60px;
      margin: 0 auto 16px;
    }
    .email-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: bold;
      margin: 0;
    }
    .email-content {
      padding: 40px 30px;
      line-height: 1.6;
      color: #333333;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #F699FC 0%, #00C49A 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .footer-links {
      margin-top: 20px;
    }
    .footer-links a {
      color: #6b7280;
      text-decoration: none;
      margin: 0 10px;
    }
    @media only screen and (max-width: 600px) {
      .email-content {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      <div class="email-logo">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#F699FC"/>
          <path d="M30 40L50 60L70 40" stroke="white" stroke-width="6" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 class="email-title">Docuralis</h1>
    </div>
    <div class="email-content">
      ${content}
    </div>
    <div class="email-footer">
      <p>© ${new Date().getFullYear()} Docuralis. All rights reserved.</p>
      <p style="margin-top: 16px; font-size: 12px;">
        This email was sent to you because you have an account with Docuralis or were invited to join.
      </p>
      <div class="footer-links">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://docuralis.com'}">Visit Website</a>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://docuralis.com'}/privacy">Privacy Policy</a>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://docuralis.com'}/terms">Terms of Service</a>
      </div>
    </div>
  </div>
</body>
</html>
  `
}
