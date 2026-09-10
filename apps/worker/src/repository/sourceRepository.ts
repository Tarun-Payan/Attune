import { desc, eq } from "drizzle-orm";
import { db } from "@attune/db/client";
import { sources, syncRuns, type Source, type SyncRun } from "@attune/db/schema";

export interface RecordSyncRunInput {
  sourceId: string;
  status: "ok" | "error";
  itemsFound: number;
  itemsNew: number;
  error?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
}

export async function findAllSources(): Promise<Source[]> {
  return db.select().from(sources);
}

export async function findSourceById(sourceId: string): Promise<Source | undefined> {
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  return source;
}

export async function updateSourceLastSync(sourceId: string, lastSyncAt: Date): Promise<void> {
  await db.update(sources).set({ lastSyncAt }).where(eq(sources.id, sourceId));
}

export async function recordSyncRun(data: RecordSyncRunInput): Promise<SyncRun> {
  const [run] = await db
    .insert(syncRuns)
    .values({
      sourceId: data.sourceId,
      status: data.status,
      itemsFound: data.itemsFound,
      itemsNew: data.itemsNew,
      error: data.error ?? null,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt ?? new Date(),
    })
    .returning();
  return run;
}

export async function getRecentSyncRunStatuses(sourceId: string, limit = 10): Promise<{ status: string }[]> {
  return db
    .select({ status: syncRuns.status })
    .from(syncRuns)
    .where(eq(syncRuns.sourceId, sourceId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit);
}

export async function disableSource(sourceId: string): Promise<void> {
  await db.update(sources).set({ enabled: false }).where(eq(sources.id, sourceId));
}
