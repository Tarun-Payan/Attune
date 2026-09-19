import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isGmailApiConfigured, buildRawEmail, sendEmail } from "./mailer";

describe("Worker Mailer", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("identifies whether Gmail API is configured", () => {
    delete process.env.GMAIL_CLIENT_ID;
    delete process.env.GMAIL_CLIENT_SECRET;
    delete process.env.GMAIL_REFRESH_TOKEN;
    expect(isGmailApiConfigured()).toBe(false);

    process.env.GMAIL_CLIENT_ID = "mock-client-id";
    process.env.GMAIL_CLIENT_SECRET = "mock-client-secret";
    process.env.GMAIL_REFRESH_TOKEN = "mock-refresh-token";
    expect(isGmailApiConfigured()).toBe(true);
  });

  it("builds a valid base64url encoded RFC 2822 email", () => {
    const raw = buildRawEmail({
      from: "Attune <brief@attune.local>",
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello World</p>",
      text: "Hello World",
    });

    expect(typeof raw).toBe("string");
    expect(raw).not.toContain("+");
    expect(raw).not.toContain("/");
    expect(raw).not.toContain("=");

    // Decode base64url
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(base64, "base64").toString("utf-8");

    expect(decoded).toContain("From: Attune <brief@attune.local>");
    expect(decoded).toContain("To: recipient@example.com");
    expect(decoded).toContain("MIME-Version: 1.0");
    expect(decoded).toContain("Content-Type: multipart/alternative");
  });

  it("sends email via Gmail REST API when credentials are set", async () => {
    process.env.GMAIL_CLIENT_ID = "mock-client-id";
    process.env.GMAIL_CLIENT_SECRET = "mock-client-secret";
    process.env.GMAIL_REFRESH_TOKEN = "mock-refresh-token";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock-access-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (urlStr.includes("gmail.googleapis.com/gmail/v1/users/me/messages/send")) {
        return new Response(
          JSON.stringify({ id: "msg_12345" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Welcome",
      html: "<p>Welcome to Attune</p>",
    });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
