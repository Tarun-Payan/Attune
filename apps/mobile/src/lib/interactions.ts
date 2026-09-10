import { AppState } from "react-native";
import type { QueryClient, InfiniteData } from "@tanstack/react-query";
import type { FeedItem, FeedPage, InteractionType, ItemDetail, ReportReason } from "./types";
import { api } from "./api";

interface PendingEvent {
  itemId: string;
  type: InteractionType;
  dwellMs?: number;
}

let queue: PendingEvent[] = [];

/**
 * Passive tracking helper.
 * VIEW events without dwellMs are batched; explicit user actions and dwell events are flushed immediately.
 */
export function trackInteraction(itemId: string, type: InteractionType, dwellMs?: number) {
  queue.push({ itemId, type, dwellMs });
  if (queue.length >= 20 || dwellMs !== undefined || type !== "VIEW") {
    void flush();
  }
}

export async function flush() {
  const batch = queue.splice(0);
  for (const ev of batch) {
    api.items
      .interact(ev.itemId, {
        type: ev.type,
        ...(ev.dwellMs !== undefined ? { dwellMs: ev.dwellMs } : {}),
      })
      .catch(() => undefined);
  }
}

// Batched upload: flush whenever the app goes to background (blueprint §13)
AppState.addEventListener("change", (state) => {
  if (state !== "active") void flush();
});

/**
 * Centralized optimistic mutation handler for item interactions (LIKE, DISLIKE, SAVE, REPORT).
 * Synchronizes React Query cache across Feed (`["feed"]`), Item Detail (`["item", id]`), and Search results (`["search"]`).
 */
export async function mutateItemInteraction(
  queryClient: QueryClient,
  itemId: string,
  type: InteractionType,
  details?: { reason?: ReportReason; details?: string },
) {
  // 1. Resolve current state from item cache or feed cache
  const itemCache = queryClient.getQueryData<{ item: ItemDetail }>(["item", itemId]);
  let currentLiked = itemCache?.item.userState?.liked;
  let currentDisliked = itemCache?.item.userState?.disliked;
  let currentSaved = itemCache?.item.userState?.saved;
  let currentLikesCount = itemCache?.item.likesCount ?? itemCache?.item.metrics?.likes ?? 0;

  let matchedFeedItem: FeedItem | undefined;
  if (currentLiked === undefined) {
    const feedCache = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed"]);
    for (const page of feedCache?.pages ?? []) {
      const match = page.items.find((it) => it.id === itemId);
      if (match) {
        matchedFeedItem = match;
        currentLiked = match.userState?.liked ?? false;
        currentDisliked = match.userState?.disliked ?? false;
        currentSaved = match.userState?.saved ?? false;
        currentLikesCount = match.likesCount ?? match.metrics?.likes ?? 0;
        break;
      }
    }
  }

  currentLiked ??= false;
  currentDisliked ??= false;
  currentSaved ??= false;

  let nextLiked = currentLiked;
  let nextDisliked = currentDisliked;
  let nextSaved = currentSaved;
  let nextLikesCount = currentLikesCount;

  if (type === "LIKE") {
    nextLiked = !currentLiked;
    if (nextLiked) {
      if (nextDisliked) nextDisliked = false;
      nextLikesCount = currentLikesCount + 1;
    } else {
      nextLikesCount = Math.max(0, currentLikesCount - 1);
    }
  } else if (type === "DISLIKE") {
    nextDisliked = !currentDisliked;
    if (nextDisliked) {
      if (nextLiked) {
        nextLiked = false;
        nextLikesCount = Math.max(0, currentLikesCount - 1);
      }
    }
  } else if (type === "SAVE") {
    nextSaved = !currentSaved;
  }

  // 2. Optimistically update item detail cache (["item", itemId])
  queryClient.setQueryData<{ item: ItemDetail }>(["item", itemId], (old) => {
    if (!old) {
      if (!matchedFeedItem) return old;
      return {
        item: {
          id: matchedFeedItem.id,
          title: matchedFeedItem.title,
          summary: matchedFeedItem.summary,
          content: matchedFeedItem.summary ?? "",
          url: matchedFeedItem.url,
          imageUrl: matchedFeedItem.imageUrl,
          author: matchedFeedItem.author ?? null,
          metrics: matchedFeedItem.metrics,
          language: "en",
          publishedAt: matchedFeedItem.publishedAt,
          clusterId: null,
          sourceName: matchedFeedItem.source.name,
          sourceCredibility: 0.8,
          topics: matchedFeedItem.topics.map((t) => ({ key: t, name: t, icon: null, confidence: 1 })),
          tags: matchedFeedItem.tags,
          likesCount: nextLikesCount,
          dislikesCount: nextDisliked ? 1 : 0,
          viewsCount: matchedFeedItem.viewsCount ?? 0,
          reportsCount: 0,
          userState: {
            liked: nextLiked,
            disliked: nextDisliked,
            saved: nextSaved,
          },
        } as ItemDetail,
      };
    }
    return {
      ...old,
      item: {
        ...old.item,
        likesCount: nextLikesCount,
        dislikesCount: nextDisliked
          ? (old.item.dislikesCount || 0) + 1
          : Math.max(0, (old.item.dislikesCount || 1) - 1),
        userState: {
          ...old.item.userState,
          liked: nextLiked,
          disliked: nextDisliked,
          saved: nextSaved,
        },
      },
    };
  });

  // 3. Optimistically update feed infinite query cache (["feed"])
  queryClient.setQueriesData<InfiniteData<FeedPage>>(
    { queryKey: ["feed"] },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  likesCount: nextLikesCount,
                  dislikesCount: nextDisliked
                    ? (it.dislikesCount || 0) + 1
                    : Math.max(0, (it.dislikesCount || 1) - 1),
                  userState: {
                    ...it.userState,
                    liked: nextLiked,
                    disliked: nextDisliked,
                    saved: nextSaved,
                  },
                }
              : it,
          ),
        })),
      };
    },
  );

  // 4. Optimistically update search caches
  queryClient.setQueriesData<{ count: number; items: FeedItem[] }>(
    { queryKey: ["search"] },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        items: old.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                likesCount: nextLikesCount,
                userState: {
                  ...it.userState,
                  liked: nextLiked,
                  disliked: nextDisliked,
                  saved: nextSaved,
                },
              }
            : it,
        ),
      };
    },
  );

  // 5. Invalidate dependent queries
  if (type === "SAVE") {
    void queryClient.invalidateQueries({ queryKey: ["saved"] });
  }
  if (type === "DISLIKE" || type === "REPORT") {
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
  }
  void queryClient.invalidateQueries({ queryKey: ["my-stats"] });

  // 6. Send directly to the server immediately
  try {
    await api.items.interact(itemId, {
      type,
      ...(details?.reason ? { reason: details.reason } : {}),
      ...(details?.details ? { details: details.details } : {}),
    });
  } catch (err) {
    // Revert to server truth on network error
    void queryClient.invalidateQueries({ queryKey: ["item", itemId] });
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
    throw err;
  }

  return { liked: nextLiked, disliked: nextDisliked, saved: nextSaved, likesCount: nextLikesCount };
}
