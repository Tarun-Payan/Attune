import nodemailer, { type Transporter } from "nodemailer";
import { createLogger } from "@attune/logger";

const log = createLogger({ service: "api", component: "mailer" });

let transporter: Transporter | null = null;

interface GmailTokenCache {
  accessToken: string;
  expiresAt: number;
}

let gmailTokenCache: GmailTokenCache | null = null;

export function isGmailApiConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN,
  );
}

async function getGmailAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN");
  }

  if (gmailTokenCache && gmailTokenCache.expiresAt > Date.now() + 60_000) {
    return gmailTokenCache.accessToken;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Failed to refresh Gmail access token (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  gmailTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return gmailTokenCache.accessToken;
}

export function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): string {
  const boundary = `__boundary_${Date.now().toString(16)}__`;
  const utf8Subject = `=?UTF-8?B?${Buffer.from(params.subject).toString("base64")}?=`;

  const headers = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
  ];

  let body = "";
  if (params.text) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(params.text, "utf-8").toString("base64"),
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(params.html, "utf-8").toString("base64"),
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    headers.push("Content-Type: text/html; charset=UTF-8");
    headers.push("Content-Transfer-Encoding: base64");
    body = Buffer.from(params.html, "utf-8").toString("base64");
  }

  const raw = `${headers.join("\r\n")}\r\n\r\n${body}`;

  return Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendViaGmailApi(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ messageId?: string }> {
  const accessToken = await getGmailAccessToken();
  const raw = buildRawEmail(input);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gmail API send failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id?: string };
  return { messageId: data.id };
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

  if (process.env.NODE_ENV === "production" && !process.env.SMTP_HOST && !isGmailApiConfigured()) {
    log.warn(
      { host, port },
      "SMTP_HOST is not configured in production and Gmail API is not active; defaulting to localhost which will likely cause connection timeouts",
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    connectionTimeout: Number(process.env.SMTP_TIMEOUT_MS ?? 15000),
  });

  return transporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const from =
    process.env.MAIL_FROM ??
    (process.env.GMAIL_USER ? `Attune <${process.env.GMAIL_USER}>` : "Attune <no-reply@attune.local>");

  if (isGmailApiConfigured()) {
    try {
      const res = await sendViaGmailApi({ ...input, from });
      log.info({ to: input.to, subject: input.subject, messageId: res.messageId }, "Email sent via Gmail API");
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error({ to: input.to, err }, "Failed to send email via Gmail API");
      return { ok: false, error };
    }
  }

  try {
    const info = await getTransporter().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    log.info({ to: input.to, subject: input.subject, messageId: info.messageId }, "Email sent successfully");
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const host = process.env.SMTP_HOST ?? "localhost";
    const port = Number(process.env.SMTP_PORT ?? 1025);
    log.warn({ to: input.to, host, port, err }, "Failed to send email");
    return { ok: false, error };
  }
}

export async function sendEmailChangeCode(newEmail: string, code: string, name?: string): Promise<void> {
  log.info({ to: newEmail }, "Email change verification code generated and dispatched");
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
  log.info({ to: oldEmail, newEmail }, "Email change security alert dispatched");
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
  log.info({ to: email }, "Password reset code generated and dispatched");
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
