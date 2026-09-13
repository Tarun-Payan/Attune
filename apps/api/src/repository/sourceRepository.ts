import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import { items, sources, syncRuns, type Source } from "@attune/db/schema";
import type { SourceConfig, SourceType, SyncStatus } from "@attune/types";

export interface CreateSourceData {
  name: string;
  type: SourceType;
  config: SourceConfig;
  credibility?: number;
  enabled?: boolean;
}

export interface UpdateSourceData {
  name?: string;
  config?: SourceConfig;
  enabled?: boolean;
  credibility?: number;
  lastSyncAt?: Date | null;
}

export interface CreateSyncRunData {
  sourceId: string;
  jobId?: string | null;
  status: SyncStatus;
  itemsFound: number;
  itemsNew: number;
  error?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
}

export async function listSources(): Promise<Source[]> {
  return db.select().from(sources).orderBy(sources.name);
}

export async function findSourceById(id: string): Promise<Source | undefined> {
  const [source] = await db.select().from(sources).where(eq(sources.id, id));
  return source;
}

export async function createSource(data: CreateSourceData): Promise<Source> {
  const [created] = await db
    .insert(sources)
    .values({
      name: data.name,
      type: data.type,
      config: data.config,
      credibility: data.credibility ?? 3,
      enabled: data.enabled ?? true,
    })
    .returning();
  return created;
}

export async function updateSource(id: string, data: UpdateSourceData): Promise<Source | undefined> {
  const [updated] = await db
    .update(sources)
    .set(data)
    .where(eq(sources.id, id))
    .returning();
  return updated;
}

export async function deleteSource(id: string): Promise<boolean> {
  const [source] = await db.select().from(sources).where(eq(sources.id, id));
  if (!source) return false;

  await db.delete(items).where(eq(items.sourceId, id));
  await db.delete(syncRuns).where(eq(syncRuns.sourceId, id));
  await db.delete(sources).where(eq(sources.id, id));
  return true;
}

export async function listSyncRuns(
  sourceId?: string,
  limit = 20,
  offset = 0,
  status?: SyncStatus,
) {
  const conditions = [];
  if (sourceId) conditions.push(eq(syncRuns.sourceId, sourceId));
  if (status) conditions.push(eq(syncRuns.status, status));
  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: syncRuns.id,
        sourceId: syncRuns.sourceId,
        sourceName: sources.name,
        sourceType: sources.type,
        jobId: syncRuns.jobId,
        status: syncRuns.status,
        itemsFound: syncRuns.itemsFound,
        itemsNew: syncRuns.itemsNew,
        error: syncRuns.error,
        startedAt: syncRuns.startedAt,
        finishedAt: syncRuns.finishedAt,
      })
      .from(syncRuns)
      .innerJoin(sources, eq(sources.id, syncRuns.sourceId))
      .where(whereCondition)
      .orderBy(desc(syncRuns.startedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(syncRuns)
      .where(whereCondition),
  ]);

  return {
    runs: rows.map((r) => ({
      ...r,
      status: r.status as SyncStatus,
    })),
    total: Number(countRow?.total ?? 0),
  };
}

export async function createSyncRun(data: CreateSyncRunData) {
  const [run] = await db.insert(syncRuns).values(data).returning();
  return run;
}

export async function updateLastSync(sourceId: string, syncAt: Date) {
  return db
    .update(sources)
    .set({ lastSyncAt: syncAt })
    .where(eq(sources.id, sourceId));
}

export async function getRecentSyncRuns(sourceId: string, limit = 10) {
  return db
    .select({ status: syncRuns.status })
    .from(syncRuns)
    .where(eq(syncRuns.sourceId, sourceId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit);
}
