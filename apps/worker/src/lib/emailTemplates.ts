export interface WelcomeEmailInput {
  name?: string | null;
  appUrl: string;
}

/** Welcome email template for new account registrations. */
export function welcomeEmailHtml(input: WelcomeEmailInput): string {
  const greeting = input.name ? `Welcome to Attune, ${escapeHtml(input.name)}!` : "Welcome to Attune!";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0e14;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0e14;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#151b27;border:1px solid #232c3e;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 24px 28px;">
              <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#6c7cff;">ATTUNE</div>
              <h1 style="margin:12px 0 0 0;color:#e8edf7;font-size:24px;line-height:1.3;">${greeting}</h1>
              <p style="margin:12px 0 0 0;color:#8b95a9;font-size:15px;line-height:1.6;">
                Your account is ready. Attune brings together the best developer news, GitHub trends, articles, and discussions from across the web into one personalized feed.
              </p>
              
              <div style="margin:24px 0;padding:18px;background:#0e131d;border:1px solid #232c3e;border-radius:12px;">
                <div style="color:#e8edf7;font-size:14px;font-weight:700;margin-bottom:8px;">Getting Started:</div>
                <div style="color:#8b95a9;font-size:13.5px;line-height:1.6;">
                  • <strong>Choose your topics:</strong> Select topics in your profile to tailor your feed.<br/>
                  • <strong>Save & curate:</strong> Bookmark important articles for quick reading.<br/>
                  • <strong>Stay up-to-date:</strong> Fresh stories sync automatically in the background.
                </div>
              </div>

              <div style="margin-top:28px;">
                <a href="${escapeHtml(input.appUrl)}" style="display:inline-block;background:#6c7cff;color:#ffffff;font-weight:700;font-size:14.5px;padding:13px 26px;border-radius:10px;text-decoration:none;">
                  Start Reading
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px 28px;border-top:1px solid #232c3e;">
              <p style="margin:0;color:#5b6478;font-size:12px;line-height:1.5;">
                You're receiving this because you created an account on Attune.
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
