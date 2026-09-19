import nodemailer, { type Transporter } from "nodemailer";
import { childLogger } from "./logger";

const log = childLogger({ component: "mailer" });

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

  // Use cached token if still valid (with a 60s buffer)
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
  // Local dev: Mailpit (docker-compose, no auth, web UI at :8025).
  // Production: Resend's SMTP relay — set SMTP_HOST=smtp.resend.com, SMTP_USER=resend,
  // SMTP_PASS=<api key>, MAIL_FROM=<verified domain>.
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
    (process.env.GMAIL_USER ? `Attune <${process.env.GMAIL_USER}>` : "Attune <brief@attune.local>");

  if (isGmailApiConfigured()) {
    try {
      const res = await sendViaGmailApi({ ...input, from });
      log.info({ to: input.to, messageId: res.messageId }, "email sent via Gmail API");
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error({ to: input.to, err }, "Gmail API email send failed");
      return { ok: false, error };
    }
  }

  try {
    const info = await getTransporter().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    });
    log.info({ to: input.to, messageId: info.messageId }, "email sent via SMTP");
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const host = process.env.SMTP_HOST ?? "localhost";
    const port = Number(process.env.SMTP_PORT ?? 1025);
    log.error({ to: input.to, host, port, err }, "email send failed");
    return { ok: false, error };
  }
}
