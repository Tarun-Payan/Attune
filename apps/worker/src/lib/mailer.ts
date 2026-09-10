import nodemailer, { type Transporter } from "nodemailer";
import { childLogger } from "./logger";

const log = childLogger({ component: "mailer" });

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  // Local dev: Mailpit (docker-compose, no auth, web UI at :8025).
  // Production: Resend's SMTP relay — set SMTP_HOST=smtp.resend.com, SMTP_USER=resend,
  // SMTP_PASS=<api key>, MAIL_FROM=<verified domain>.
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
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.MAIL_FROM ?? "Attune <brief@attune.local>",
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    log.info({ to: input.to, messageId: info.messageId }, "email sent");
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ to: input.to, error }, "email send failed");
    return { ok: false, error };
  }
}
