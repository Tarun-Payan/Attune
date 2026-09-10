import { createHash } from "node:crypto";

const TRACKING_PARAM = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref_src|ref_url|ref|si)$/i;

/** Canonicalize a URL so the same story from different trackers counts once. */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  const drop: string[] = [];
  u.searchParams.forEach((_v, k) => {
    if (TRACKING_PARAM.test(k)) drop.push(k);
  });
  drop.forEach((k) => u.searchParams.delete(k));
  if ([...u.searchParams.keys()].length === 0) u.search = "";
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  return u.toString();
}

export function hashUrl(raw: string): string {
  return createHash("sha256").update(normalizeUrl(raw)).digest("hex");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
