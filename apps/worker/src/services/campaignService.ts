import { notify } from "@attune/notifications";
import { childLogger } from "../lib/logger";
import { sendEmail } from "../lib/mailer";
import { sendToUserDevices } from "../lib/push";
import {
  createNotificationLog,
  findCampaignAudience,
  getUserNotificationPrefs,
} from "../repository";

const log = childLogger({ component: "campaignService" });

export interface ExecuteCampaignInput {
  title: string;
  body: string;
  channel: "push" | "email";
  topicKey?: string;
  userIds?: string[];
}

export interface CampaignResult {
  sent: number;
  failed: number;
  skipped: number;
}

export async function executeCampaign(input: ExecuteCampaignInput): Promise<CampaignResult> {
  const { title, body, channel, topicKey, userIds } = input;
  const targets = await findCampaignAudience(topicKey, userIds);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of targets) {
    const prefs = await getUserNotificationPrefs(user.id);
    if (channel === "push" && prefs && !prefs.pushEnabled) {
      skipped += 1;
      continue;
    }
    if (channel === "email" && prefs && !prefs.emailEnabled) {
      skipped += 1;
      continue;
    }

    // Always deliver in-app notification to user's inbox
    await notify.campaign(user.id, { title, body }).catch(() => {});

    if (channel === "push") {
      const r = await sendToUserDevices(user.id, { title, body });
      if (r.delivered) {
        sent += 1;
        await createNotificationLog({ userId: user.id, channel: "push", kind: "campaign", status: "sent" });
      } else {
        failed += 1;
        await createNotificationLog({
          userId: user.id,
          channel: "push",
          kind: "campaign",
          status: "failed",
          error: r.error,
        });
      }
    } else {
      const r = await sendEmail({
        to: user.email,
        subject: title,
        html: campaignEmailHtml(title, body),
      });
      if (r.ok) {
        sent += 1;
        await createNotificationLog({ userId: user.id, channel: "email", kind: "campaign", status: "sent" });
      } else {
        failed += 1;
        await createNotificationLog({
          userId: user.id,
          channel: "email",
          kind: "campaign",
          status: "failed",
          error: r.error,
        });
      }
    }
  }

  log.info({ sent, failed, skipped }, "campaign completed");
  return { sent, failed, skipped };
}

function campaignEmailHtml(title: string, body: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><body style="margin:0;background:#0b0e14;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:#0b0e14;">
      <tr><td align="center">
        <table role="presentation" style="max-width:520px;background:#151b27;border:1px solid #232c3e;border-radius:18px;">
          <tr><td style="padding:28px;">
            <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#6c7cff;">ATTUNE</div>
            <h1 style="margin:8px 0;color:#e8edf7;font-size:22px;">${esc(title)}</h1>
            <p style="margin:0;color:#8b95a9;font-size:15px;line-height:1.6;">${esc(body)}</p>
            <p style="margin:22px 0 0 0;color:#5b6478;font-size:11.5px;">Announcement from the Attune team. Manage notifications in the app.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}
