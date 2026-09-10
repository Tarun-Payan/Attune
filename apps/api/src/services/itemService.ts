import type { InteractionInput, ItemDetailDTO } from "@attune/schemas";
import { findItemById, getItemTopics } from "../repository/itemRepository";
import { getItemTagKeys } from "../repository/tagRepository";
import { checkItemExists, getUserItemState, recordInteraction as recordInteractionRepo } from "../repository/interactionRepository";
import { NotFoundError } from "../errors";

export async function getItemDetail(id: string, userId?: string): Promise<ItemDetailDTO> {
  const row = await findItemById(id);
  if (!row || row.hidden) {
    throw new NotFoundError("Item not found");
  }

  const { hidden: _hidden, ...item } = row;
  const topicRows = await getItemTopics(row.id);
  const tagKeys = await getItemTagKeys(row.id);

  let userState;
  if (userId) {
    const states = await getUserItemState(userId, [row.id]);
    userState = states.get(row.id);
  }

  return {
    ...item,
    topics: topicRows,
    tags: tagKeys,
    userState,
  };
}

export async function recordInteraction(userId: string, itemId: string, input: InteractionInput) {
  const item = await checkItemExists(itemId);
  if (!item) {
    throw new NotFoundError("Item not found");
  }

  await recordInteractionRepo({
    userId,
    itemId,
    type: input.type,
    dwellMs: input.dwellMs ?? null,
    reason: input.reason,
    details: input.details,
  });

  return { recorded: true as const };
}
