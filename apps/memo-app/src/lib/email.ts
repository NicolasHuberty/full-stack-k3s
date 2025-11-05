import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.SMTP_USER || "contact@huberty.pro",
    pass: process.env.SMTP_PASSWORD || "$BPANrglh002",
  },
});

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Mail.Attachment[];
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: '"Memo App" <contact@huberty.pro>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      attachments: options.attachments,
    });
    console.log(`[Email] Sent to ${options.to}: ${options.subject}`);
  } catch (error) {
    console.error(`[Email] Failed to send to ${options.to}:`, error);
    throw error;
  }
}

export async function send2FAEmail(
  email: string,
  userName: string,
): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 Two-Factor Authentication Enabled</h1>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>

      <p>Two-factor authentication (2FA) has been successfully enabled on your Memo App account.</p>

      <p>Your account is now protected with an additional layer of security. You'll need to enter a code from your authenticator app whenever you sign in.</p>

      <p><strong>Important security tips:</strong></p>
      <ul>
        <li>Keep your backup codes in a safe place</li>
        <li>Don't share your 2FA codes with anyone</li>
        <li>If you lose access to your authenticator app, use one of your backup codes</li>
      </ul>

      <p>If you didn't enable 2FA, please contact support immediately.</p>

      <p>Best regards,<br>The Memo App Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Memo App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: email,
    subject: "Two-Factor Authentication Enabled - Memo App",
    html,
  });
}

export async function sendMemoCompletedEmail(
  email: string,
  userName: string,
  memoTitle: string,
  transcriptionUrl: string,
  documentUrls: { type: string; url: string }[],
): Promise<void> {
  const documentLinks = documentUrls
    .map(
      (doc) =>
        `<li><a href="${doc.url}" style="color: #4F46E5; text-decoration: none;">${doc.type.toUpperCase()} Document</a></li>`,
    )
    .join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .memo-title { background-color: white; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981; }
    .documents { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .documents ul { list-style: none; padding: 0; }
    .documents li { padding: 8px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Your Memo is Ready!</h1>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>

      <p>Great news! Your voice memo has been transcribed and processed successfully.</p>

      <div class="memo-title">
        <h2 style="margin: 0; color: #10b981;">📝 ${memoTitle}</h2>
      </div>

      <div class="documents">
        <h3 style="margin-top: 0;">📎 Your Documents:</h3>
        <ul>
          <li><a href="${transcriptionUrl}" style="color: #4F46E5; text-decoration: none;">📄 Transcription (TXT)</a></li>
          ${documentLinks}
        </ul>
      </div>

      <p>You can also view and manage your memo in the app.</p>

      <p>Best regards,<br>The Memo App Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Memo App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: email,
    subject: `Memo Ready: ${memoTitle} - Memo App`,
    html,
  });
}
