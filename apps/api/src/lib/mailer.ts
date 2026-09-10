import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: Number(process.env.SMTP_PORT ?? 1025) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  return transporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const from = process.env.MAIL_FROM ?? "Attune <no-reply@attune.local>";

  try {
    const info = await getTransporter().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    console.log(`[MAILER] Sent email to ${input.to} (${input.subject}) - ID: ${info.messageId}`);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[MAILER WARNING] Failed to send email to ${input.to}: ${error}`);
    return { ok: false, error };
  }
}

export async function sendEmailChangeCode(newEmail: string, code: string, name?: string): Promise<void> {
  console.log(`[VERIFICATION CODE] Email Change Verification Code for ${newEmail}: ${code}`);
  const displayName = name ? `Hi ${name},` : "Hello,";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="color: #111827; margin-top: 0;">Verify Your New Email Address</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">${displayName}</p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">
        You recently requested to update your Attune account email address to <strong>${newEmail}</strong>.
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 12px 28px;">
          ${code}
        </span>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
        This verification code will expire in <strong>15 minutes</strong>. If you did not make this request, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Attune Platform Security &bull; support@attune.com
      </p>
    </div>
  `;

  await sendEmail({
    to: newEmail,
    subject: `Your Attune Email Verification Code: ${code}`,
    html,
    text: `Your Attune email verification code is: ${code}. Valid for 15 minutes.`,
  });
}

export async function sendEmailChangeAlert(oldEmail: string, newEmail: string, name?: string): Promise<void> {
  console.log(`[SECURITY ALERT] Email Change Security Alert sent to old email: ${oldEmail} (changed to: ${newEmail})`);
  const displayName = name ? `Hi ${name},` : "Hello,";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="color: #dc2626; margin-top: 0;">Security Alert: Account Email Changed</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">${displayName}</p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">
        The email address for your Attune account was recently changed to:
      </p>
      <div style="margin: 20px 0; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; color: #991b1b; font-weight: 600; font-size: 15px;">
        ${newEmail}
      </div>
      <p style="color: #b91c1c; font-size: 14px; line-height: 1.5; font-weight: 500;">
        ⚠️ If this action was not performed or permitted by you, please immediately contact our security team at
        <a href="mailto:support@attune.com" style="color: #dc2626; text-decoration: underline;">support@attune.com</a> so we can secure your account.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Attune Platform Security &bull; support@attune.com
      </p>
    </div>
  `;

  await sendEmail({
    to: oldEmail,
    subject: "Security Alert: Your Attune account email was changed",
    html,
    text: `Security Alert: Your Attune account email was changed to ${newEmail}. If this action was not permitted by you, contact support@attune.com immediately.`,
  });
}

export async function sendPasswordResetCode(email: string, code: string, name?: string): Promise<void> {
  console.log(`[VERIFICATION CODE] Password Reset Code for ${email}: ${code}`);
  const displayName = name ? `Hi ${name},` : "Hello,";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="color: #111827; margin-top: 0;">Reset Your Password</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">${displayName}</p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">
        We received a request to reset the password for your Attune account. Enter the verification code below to set a new password:
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 12px 28px;">
          ${code}
        </span>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
        This code expires in <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Attune Platform Security &bull; support@attune.com
      </p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `Your Attune Password Reset Code: ${code}`,
    html,
    text: `Your Attune password reset code is: ${code}. Valid for 15 minutes.`,
  });
}
