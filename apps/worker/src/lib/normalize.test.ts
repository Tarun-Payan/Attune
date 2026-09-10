import { describe, expect, it } from "vitest";
import { hashUrl, normalizeUrl, stripHtml, truncate } from "./normalize";

describe("normalizeUrl (dedupe key)", () => {
  it("strips tracking parameters", () => {
    expect(normalizeUrl("https://example.com/a?utm_source=x&id=2")).toBe("https://example.com/a?id=2");
  });

  it("treats www and bare host as the same story", () => {
    expect(normalizeUrl("https://www.theverge.com/x")).toBe(normalizeUrl("https://theverge.com/x"));
  });

  it("drops fragments and trailing slashes", () => {
    expect(normalizeUrl("https://example.com/x/#section")).toBe("https://example.com/x");
  });

  it("is stable (same input → same hash)", () => {
    expect(hashUrl("https://example.com/a?utm_source=rss")).toBe(
      hashUrl("https://example.com/a"),
    );
  });

  it("produces different hashes for different stories", () => {
    expect(hashUrl("https://example.com/a")).not.toBe(hashUrl("https://example.com/b"));
  });
});

describe("stripHtml", () => {
  it("removes tags, scripts and entities", () => {
    expect(
      stripHtml("<p>Hello <b>world</b></p><script>alert(1)</script>&amp; more"),
    ).toBe("Hello world & more");
  });
});


describe("truncate", () => {
  it("keeps short strings untouched and adds an ellipsis past the limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello world", 8)).toHaveLength(8);
    expect(truncate("hello world", 8).endsWith("…")).toBe(true);
  });
});
