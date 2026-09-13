import type { Job } from "bullmq";
import { welcomeEmailJobSchema } from "@attune/schemas";
import { welcomeEmailHtml } from "../lib/emailTemplates";
import { sendEmail } from "../lib/mailer";
import { createNotificationLog } from "../repository";
import { createJobLogger, logger } from "../lib/logger";

/**
 * Transactional Welcome Email processor: triggered upon new registration or OAuth signup.
 */
export async function welcomeEmailProcessor(job: Job) {
  const parsed = welcomeEmailJobSchema.safeParse(job.data);
  if (!parsed.success) {
    logger.warn({ jobId: job.id, errors: parsed.error.format() }, "invalid welcome email payload");
    return { ok: false, error: "Invalid job payload" };
  }

  const { userId, email, name } = parsed.data;
  const jobLog = createJobLogger(logger, job, "pipeline");
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

  jobLog.info({ userId, email, ok: result.ok }, "welcome email processed");
  return { ok: result.ok, error: result.error };
}
