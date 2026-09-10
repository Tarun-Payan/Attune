import type { CursorPayload } from "@attune/types";
import type { FeedQueryInput, FeedResponseDTO, SearchQueryInput } from "@attune/schemas";
import { findPersonalizedFeed, searchItems } from "../repository/itemRepository";
import { BadRequestError } from "../errors";

export function encodeCursor(c: CursorPayload): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string): CursorPayload | null {
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString()) as CursorPayload;
    if (
      typeof c.t !== "number" ||
      !Number.isFinite(c.t) ||
      typeof c.s !== "number" ||
      typeof c.id !== "string"
    ) {
      return null;
    }
    return c;
  } catch {
    return null;
  }
}

export async function getPersonalizedFeed(userId: string, query: FeedQueryInput): Promise<FeedResponseDTO> {
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50);
  const topicKeys = query.topics
    ? query.topics.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  let cursor: CursorPayload | null = null;
  if (query.cursor) {
    cursor = decodeCursor(query.cursor);
    if (!cursor) {
      throw new BadRequestError("Invalid cursor");
    }
  }

  const refTime = cursor ? new Date(cursor.t) : new Date();

  const { items, rawScores } = await findPersonalizedFeed({
    userId,
    limit,
    topicKeys,
    cursor,
  });

  const nextCursor =
    items.length === limit && rawScores.length > 0
      ? encodeCursor({
          t: refTime.getTime(),
          s: rawScores[rawScores.length - 1].score,
          id: rawScores[rawScores.length - 1].id,
        })
      : null;

  return {
    count: items.length,
    items,
    nextCursor,
  };
}

export async function search(query: SearchQueryInput) {
  const q = (query.q ?? "").trim();
  if (q.length < 2) {
    throw new BadRequestError("Query must be at least 2 characters");
  }
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 50);

  const items = await searchItems(q, limit);
  return {
    count: items.length,
    items,
  };
}
