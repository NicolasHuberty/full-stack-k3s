import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true, // Use SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text: text || undefined,
      html,
    });

    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bienvenue sur Memo App!</h1>
          </div>
          <div class="content">
            <h2>Vérifiez votre adresse email</h2>
            <p>Merci de vous être inscrit! Cliquez sur le bouton ci-dessous pour vérifier votre adresse email:</p>
            <a href="${verificationUrl}" class="button">Vérifier mon email</a>
            <p>Ou copiez ce lien dans votre navigateur:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p>Ce lien expirera dans 24 heures.</p>
          </div>
          <div class="footer">
            <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Vérifiez votre email - Memo App",
    html,
    text: `Bienvenue sur Memo App! Vérifiez votre email en visitant: ${verificationUrl}`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Réinitialisation de mot de passe</h1>
          </div>
          <div class="content">
            <h2>Réinitialisez votre mot de passe</h2>
            <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous:</p>
            <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
            <p>Ou copiez ce lien dans votre navigateur:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p>Ce lien expirera dans 1 heure.</p>
          </div>
          <div class="footer">
            <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Réinitialisez votre mot de passe - Memo App",
    html,
    text: `Réinitialisez votre mot de passe en visitant: ${resetUrl}`,
  });
}

export async function sendMemoCompletedEmail(
  email: string,
  memoTitle: string,
  memoContent: string,
  memoId: string,
  attachments?: Array<{ filename: string; path: string }>,
) {
  const memoUrl = `${process.env.NEXT_PUBLIC_APP_URL}/memos/${memoId}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .memo-content { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .attachments { margin: 20px 0; }
          .attachment { background: white; padding: 10px; margin: 5px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Votre mémo est prêt!</h1>
          </div>
          <div class="content">
            <h2>${memoTitle}</h2>
            <p>Votre mémo a été traité avec succès par notre IA. Voici le résultat:</p>
            <div class="memo-content">
              <pre style="white-space: pre-wrap; font-family: inherit;">${memoContent.substring(0, 1000)}${memoContent.length > 1000 ? "..." : ""}</pre>
            </div>
            ${
              attachments && attachments.length > 0
                ? `
              <div class="attachments">
                <h3>Documents joints:</h3>
                ${attachments.map((att) => `<div class="attachment">📄 ${att.filename}</div>`).join("")}
              </div>
            `
                : ""
            }
            <a href="${memoUrl}" class="button">Voir le mémo complet</a>
          </div>
          <div class="footer">
            <p>Memo App - Vos notes transformées par l'IA</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `✅ Mémo terminé: ${memoTitle}`,
    html,
    text: `Votre mémo "${memoTitle}" est prêt! Consultez-le sur: ${memoUrl}`,
  });
}
