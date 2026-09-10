import type { Tag } from "./tag";

export interface Topic {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  parentId?: string | null;
  tags?: Tag[];
}

export interface AdminTopicRow extends Topic {
  itemTotal: number;
  itemWeek: number;
  followers: number;
  tagCount?: number;
}

export interface TopicsResponse {
  count: number;
  topics: Topic[];
}

export interface AdminTopicsResponse {
  count: number;
  topics: AdminTopicRow[];
}

export interface TopicOption {
  key: string;
  name: string;
}

