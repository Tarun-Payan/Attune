import type { InteractionType, ReportReason } from "./enums";

export interface ItemUserState {
  liked: boolean;
  disliked: boolean;
  saved: boolean;
}

export interface ReportItemInput {
  reason: ReportReason;
  details?: string;
}

export interface ItemTopicConfidence {
  key: string;
  name: string;
  icon: string | null;
  confidence: number;
}

export interface ItemDetail {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  url: string;
  imageUrl: string | null;
  author: string | null;
  metrics: Record<string, number> | null;
  language: string;
  publishedAt: string;
  clusterId: string | null;
  sourceName: string;
  sourceCredibility: number;
  topics: ItemTopicConfidence[];
  tags?: string[];
  likesCount: number;
  dislikesCount: number;
  viewsCount: number;
  reportsCount: number;
  userState?: ItemUserState;
}

export interface FeedItem {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  author?: string | null;
  metrics: Record<string, number> | null;
  publishedAt: string;
  source: { name: string };
  topics: string[];
  tags?: string[];
  clusterSize?: number;
  score: number;
  likesCount: number;
  dislikesCount: number;
  viewsCount: number;
  reportsCount: number;
  userState?: ItemUserState;
  isExploration?: boolean;
}

export interface SavedItem {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  savedAt: string;
}

export interface AdminItemRow {
  id: string;
  title: string;
  url: string;
  author: string | null;
  metrics: Record<string, number> | null;
  hidden: boolean;
  publishedAt: string;
  createdAt: string;
  sourceName: string;
  topics: string[];
  tags?: string[];
  likesCount: number;
  dislikesCount: number;
  viewsCount: number;
  reportsCount: number;
}

export interface InteractionRecord {
  id: string;
  userId: string;
  itemId: string;
  type: InteractionType;
  dwellMs?: number | null;
  createdAt: Date | string;
}

export interface FeedResponse {
  count: number;
  items: FeedItem[];
  nextCursor: string | null;
}
export type FeedPage = FeedResponse;

export interface SavedItemsResponse {
  count: number;
  items: SavedItem[];
}

export interface SearchResponse {
  count: number;
  items: FeedItem[];
}

export interface AdminItemsResponse {
  count: number;
  items: AdminItemRow[];
  hasMore: boolean;
}

