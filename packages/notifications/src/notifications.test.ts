import { describe, it, expect, vi } from "vitest";
import { templates } from "./templates";
import { notify } from "./index";
import * as inAppModule from "./in-app";

describe("Notification Templates", () => {
  it("generates security password changed notification", () => {
    const t = templates.securityPasswordChanged();
    expect(t.title).toBe("Security Alert: Password Changed");
    expect(t.body).toContain("Your password was recently changed");
    expect(t.kind).toBe("security");
  });

  it("generates security email changed notification with new email address", () => {
    const t = templates.securityEmailChanged("new@example.com");
    expect(t.title).toBe("Security Alert: Email Updated");
    expect(t.body).toContain("new@example.com");
    expect(t.kind).toBe("security");
  });

  it("generates welcome notification with user name", () => {
    const tplWithName = templates.welcome("Alice");
    expect(tplWithName.title).toBe("Welcome to Attune, Alice!");
    expect(tplWithName.kind).toBe("welcome");

    const tplWithoutName = templates.welcome();
    expect(tplWithoutName.title).toBe("Welcome to Attune!");
    expect(tplWithoutName.kind).toBe("welcome");
  });

  it("generates tech update notification and truncates long titles", () => {
    const shortT = templates.techUpdate("React 19 Released", "Frontend");
    expect(shortT.title).toBe("New in Frontend");
    expect(shortT.body).toBe("React 19 Released");
    expect(shortT.kind).toBe("topic_match");

    const longTitle = "A".repeat(150);
    const longT = templates.techUpdate(longTitle);
    expect(longT.title).toBe("New for you");
    expect(longT.body.length).toBe(120);
    expect(longT.body.endsWith("...")).toBe(true);
  });

  it("generates campaign notification", () => {
    const t = templates.campaign("Monthly Digest", "Check out the top stories");
    expect(t.title).toBe("Monthly Digest");
    expect(t.body).toBe("Check out the top stories");
    expect(t.kind).toBe("campaign");
  });
});

describe("notify Facade", () => {
  it("routes passwordChanged through in-app sender with correct payload", async () => {
    const spy = vi.spyOn(inAppModule, "sendInAppNotification").mockResolvedValue({ id: "notif_1" } as any);

    await notify.passwordChanged("user_123");

    expect(spy).toHaveBeenCalledWith({
      userId: "user_123",
      title: "Security Alert: Password Changed",
      body: expect.stringContaining("password"),
      kind: "security",
    });

    spy.mockRestore();
  });

  it("routes emailChanged through in-app sender with correct payload", async () => {
    const spy = vi.spyOn(inAppModule, "sendInAppNotification").mockResolvedValue({ id: "notif_2" } as any);

    await notify.emailChanged("user_123", "alice@example.com");

    expect(spy).toHaveBeenCalledWith({
      userId: "user_123",
      title: "Security Alert: Email Updated",
      body: expect.stringContaining("alice@example.com"),
      kind: "security",
    });

    spy.mockRestore();
  });

  it("routes welcome through in-app sender", async () => {
    const spy = vi.spyOn(inAppModule, "sendInAppNotification").mockResolvedValue({ id: "notif_3" } as any);

    await notify.welcome("user_123", "Alice");

    expect(spy).toHaveBeenCalledWith({
      userId: "user_123",
      title: "Welcome to Attune, Alice!",
      body: expect.any(String),
      kind: "welcome",
    });

    spy.mockRestore();
  });

  it("routes techUpdate with topic and item ID", async () => {
    const spy = vi.spyOn(inAppModule, "sendInAppNotification").mockResolvedValue({ id: "notif_4" } as any);

    await notify.techUpdate("user_123", {
      title: "TypeScript 5.8 is out",
      topicName: "TypeScript",
      itemId: "item_999",
    });

    expect(spy).toHaveBeenCalledWith({
      userId: "user_123",
      itemId: "item_999",
      data: { itemId: "item_999" },
      title: "New in TypeScript",
      body: "TypeScript 5.8 is out",
      kind: "topic_match",
    });

    spy.mockRestore();
  });
});
