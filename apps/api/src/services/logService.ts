import type {
  AdminLogEntryDTO,
  AdminLogsOverviewDTO,
  AdminLogStatsSummary,
  LogTopErrorItem,
} from "@attune/types";
import type { AdminLogsQueryInput } from "@attune/schemas";
import { getLogBufferMaxCache } from "@attune/logger";
import {
  clearLogBuffer,
  fetchRecentLogsFromBuffer,
  getLogBufferCount,
} from "../repository/logRepository";

const LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

function resolveLevelLabel(level: number): string {
  return LEVEL_LABELS[level] ?? "info";
}

function matchesLevelFilter(logLevel: number, levelFilter?: string): boolean {
  if (!levelFilter || levelFilter === "all") return true;
  const lower = levelFilter.toLowerCase().trim();

  if (lower === "error") return logLevel >= 50;
  if (lower === "warn") return logLevel === 40;
  if (lower === "info") return logLevel === 30;
  if (lower === "debug") return logLevel <= 20;

  const num = Number(lower);
  if (!Number.isNaN(num)) return logLevel === num;

  return resolveLevelLabel(logLevel) === lower;
}

export async function getAdminLogs(query: AdminLogsQueryInput): Promise<AdminLogsOverviewDTO> {
  const maxCache = getLogBufferMaxCache();
  const rawLines = await fetchRecentLogsFromBuffer(maxCache);
  const totalInBuffer = await getLogBufferCount();

  const parsedLogs: AdminLogEntryDTO[] = [];

  for (const line of rawLines) {
    try {
      const obj = JSON.parse(line);
      const level = typeof obj.level === "number" ? obj.level : 30;
      parsedLogs.push({
        time: obj.time ?? Date.now(),
        level,
        levelLabel: resolveLevelLabel(level),
        service: obj.service ?? "unknown",
        environment: obj.environment ?? "production",
        msg: obj.msg ?? obj.message ?? "",
        requestId: obj.requestId,
        jobId: obj.jobId,
        jobName: obj.jobName,
        runId: obj.runId,
        userId: obj.userId,
        userRole: obj.userRole,
        adminRole: obj.adminRole,
        ip: obj.ip,
        userAgent: obj.userAgent,
        method: obj.method,
        url: obj.url,
        statusCode: obj.statusCode,
        responseTime: obj.responseTime,
        query: obj.query,
        params: obj.params,
        component: obj.component,
        queue: obj.queue,
        sourceId: obj.sourceId,
        source: obj.source,
        err: obj.err ?? obj.error,
        ...obj,
      });
    } catch {
      // skip unparseable lines
    }
  }

  const filtered = parsedLogs.filter((item) => {
    if (query.service && query.service !== "all" && item.service.toLowerCase() !== query.service.toLowerCase()) {
      return false;
    }

    if (query.level && !matchesLevelFilter(item.level, query.level)) {
      return false;
    }

    if (query.requestId && item.requestId !== query.requestId && !item.requestId?.includes(query.requestId)) {
      return false;
    }

    if (query.runId && item.runId !== query.runId && !item.runId?.includes(query.runId)) {
      return false;
    }

    if (query.jobId && String(item.jobId) !== query.jobId && !String(item.jobId).includes(query.jobId)) {
      return false;
    }

    if (query.userId && item.userId !== query.userId && !item.userId?.includes(query.userId)) {
      return false;
    }

    if (query.sourceId && item.sourceId !== query.sourceId && !item.sourceId?.includes(query.sourceId)) {
      return false;
    }

    if (query.q && query.q.trim()) {
      const q = query.q.toLowerCase().trim();
      const searchable = [
        item.msg,
        item.service,
        item.requestId,
        item.jobId,
        item.runId,
        item.sourceId,
        item.source,
        item.sourceName,
        item.userId,
        item.userRole,
        item.adminRole,
        item.ip,
        item.url,
        item.method,
        item.component,
        item.queue,
        item.err?.message,
        item.err?.stack,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    count: filtered.length,
    totalInBuffer,
    maxCache,
    logs: paginated,
  };
}

export async function clearAdminLogs(): Promise<{ cleared: true; deletedCount: number }> {
  const deletedCount = await clearLogBuffer();
  return { cleared: true, deletedCount };
}

export async function getLogStatsSummary(): Promise<AdminLogStatsSummary> {
  const maxCache = getLogBufferMaxCache();
  const rawLines = await fetchRecentLogsFromBuffer(maxCache);

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalDebug = 0;
  const impactedUsers = new Set<string>();
  const errorMap = new Map<string, { count: number; service: string; lastSeen: number }>();

  for (const line of rawLines) {
    try {
      const obj = JSON.parse(line);
      const level = typeof obj.level === "number" ? obj.level : 30;

      if (level >= 50) {
        totalErrors++;
        if (obj.userId) {
          impactedUsers.add(String(obj.userId));
        }

        const rawMsg = String(obj.err?.message || obj.msg || "Unknown Error").trim();
        const normalizedMsg = rawMsg.split("\n")[0].slice(0, 120);
        const existing = errorMap.get(normalizedMsg);
        const service = String(obj.service || "unknown");
        const time = typeof obj.time === "number" ? obj.time : Date.now();

        if (existing) {
          existing.count++;
          if (time > existing.lastSeen) {
            existing.lastSeen = time;
            existing.service = service;
          }
        } else {
          errorMap.set(normalizedMsg, { count: 1, service, lastSeen: time });
        }
      } else if (level === 40) {
        totalWarnings++;
        if (obj.userId) {
          impactedUsers.add(String(obj.userId));
        }
      } else if (level <= 20) {
        totalDebug++;
      }
    } catch {
      // ignore parse errors
    }
  }

  const topErrors: LogTopErrorItem[] = Array.from(errorMap.entries())
    .map(([message, meta]) => ({
      message,
      count: meta.count,
      service: meta.service,
      lastSeen: meta.lastSeen,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalErrors,
    totalWarnings,
    totalDebug,
    impactedUsersCount: impactedUsers.size,
    topErrors,
  };
}
