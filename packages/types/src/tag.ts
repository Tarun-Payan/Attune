export interface Tag {
  id: string;
  key: string;
  name: string;
  topicId?: string | null;
  createdAt?: Date | string;
}

export interface AdminTagRow extends Tag {
  itemCount: number;
  topicName?: string | null;
}

export interface TagsResponse {
  count: number;
  tags: Tag[];
}

export interface AdminTagsResponse {
  count: number;
  tags: AdminTagRow[];
}
