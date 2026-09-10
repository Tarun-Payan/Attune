import type { Job } from "bullmq";
import { welcomeEmailJobSchema } from "@attune/schemas";
import { welcomeEmailHtml } from "../lib/emailTemplates";
import { sendEmail } from "../lib/mailer";
import { createNotificationLog } from "../repository";
import { childLogger } from "../lib/logger";

const log = childLogger({ component: "welcomeEmailProcessor" });

/**
 * Transactional Welcome Email processor: triggered upon new registration or OAuth signup.
 */
export async function welcomeEmailProcessor(job: Job) {
  const parsed = welcomeEmailJobSchema.safeParse(job.data);
  if (!parsed.success) {
    log.warn({ errors: parsed.error.format() }, "invalid welcome email payload");
    return { ok: false, error: "Invalid job payload" };
  }

  const { userId, email, name } = parsed.data;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const result = await sendEmail({
    to: email,
    subject: name ? `Welcome to Attune, ${name}!` : "Welcome to Attune!",
    html: welcomeEmailHtml({ name, appUrl }),
  });

  await createNotificationLog({
    userId,
    channel: "email",
    kind: "welcome",
    status: result.ok ? "sent" : "failed",
    error: result.error,
  });

  log.info({ userId, email, ok: result.ok }, "welcome email processed");
  return { ok: result.ok, error: result.error };
}

