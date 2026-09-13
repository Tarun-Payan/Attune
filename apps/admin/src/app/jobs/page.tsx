"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Copy,
  ExternalLink,
  Eye,
  Layers,
  ListFilter,
  RefreshCw,
  Terminal,
  Wrench,
} from "lucide-react";
import type { SyncRun } from "@attune/types";
import { toast } from "sonner";
import { api, bullBoardUrl } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  ColumnDef,
  ColumnVisibilityDropdown,
  Modal,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Td,
  Th,
  useColumnVisibility,
} from "@/components/ui";

const SYNC_RUN_COLUMNS: ColumnDef[] = [
  { id: "source", label: "Source", defaultVisible: true, required: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "found", label: "Found", defaultVisible: true },
  { id: "new", label: "New", defaultVisible: true },
  { id: "duration", label: "Duration", defaultVisible: true },
  { id: "detail", label: "Detail", defaultVisible: true },
  { id: "started", label: "Started", defaultVisible: true },
  { id: "actions", label: "Actions", defaultVisible: true },
];

function formatDuration(startedAt: Date | string, finishedAt: Date | string | null): string {
  if (!finishedAt) return "In progress…";
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (isNaN(start) || isNaN(end)) return "—";
  const diffMs = Math.max(0, end - start);
  if (diffMs < 1000) return `${diffMs}ms`;
  const seconds = (diffMs / 1000).toFixed(1);
  if (diffMs < 60000) return `${seconds}s`;
  const mins = Math.floor(diffMs / 60000);
  const remSec = Math.floor((diffMs % 60000) / 1000);
  return `${mins}m ${remSec}s`;
}

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "—";
  const time = new Date(date).getTime();
  if (isNaN(time)) return "—";
  const diff = Math.floor((Date.now() - time) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getErrorDiagnostic(error: string | null): {
  category: string;
  badgeVariant: "destructive" | "warning" | "default";
  summary: string;
  remediation: string;
} {
  if (!error) {
    return {
      category: "Success / No Error",
      badgeVariant: "default",
      summary: "This sync job completed successfully without reported errors.",
      remediation: "No remediation required.",
    };
  }

  const err = error.toLowerCase();

  if (
    err.includes("econnrefused") ||
    err.includes("enotfound") ||
    err.includes("ehostunreach") ||
    err.includes("getaddrinfo") ||
    err.includes("dns")
  ) {
    return {
      category: "DNS / Network Connection Refused",
      badgeVariant: "destructive",
      summary: "The background worker was unable to reach or resolve the source host server.",
      remediation:
        "Check that the source feed URL domain is valid, reachable, and not blocked by firewall rules or server DNS.",
    };
  }

  if (err.includes("404") || err.includes("not found")) {
    return {
      category: "HTTP 404 (Feed Not Found)",
      badgeVariant: "destructive",
      summary: "The target feed or endpoint does not exist at the requested URL.",
      remediation:
        "Verify the URL path in Source Settings. The publisher may have changed or removed their RSS/Atom feed address.",
    };
  }

  if (
    err.includes("429") ||
    err.includes("too many requests") ||
    err.includes("rate limit") ||
    err.includes("challenge") ||
    err.includes("security checkpoint")
  ) {
    return {
      category: "Rate Limited / Anti-Bot Challenge (HTTP 429)",
      badgeVariant: "warning",
      summary:
        "The external source has throttled requests or presented an anti-bot challenge (e.g. Vercel Security Checkpoint).",
      remediation:
        "The upstream host is challenging automated crawlers. Wait for the rate-limit window to expire or configure a slower polling schedule.",
    };
  }

  if (
    err.includes("401") ||
    err.includes("403") ||
    err.includes("unauthorized") ||
    err.includes("forbidden") ||
    err.includes("access denied") ||
    err.includes("cloudflare")
  ) {
    return {
      category: "HTTP 401/403 (Access Denied / Anti-Bot)",
      badgeVariant: "destructive",
      summary: "The target endpoint rejected the request due to missing authorization or anti-bot / Cloudflare challenge.",
      remediation:
        "Check if this source requires API credentials, custom headers, or if the provider blocks datacenter IP addresses.",
    };
  }

  if (
    err.includes("etimedout") ||
    err.includes("timeout") ||
    err.includes("esockettimedout") ||
    err.includes("abort") ||
    err.includes("econnreset")
  ) {
    return {
      category: "Request Timeout (ETIMEDOUT)",
      badgeVariant: "warning",
      summary: "The request exceeded the allotted network timeout threshold before receiving a complete response.",
      remediation:
        "The upstream source is responding slowly or experiencing downtime. Try retrying the sync job or configuring longer timeouts.",
    };
  }

  if (
    err.includes("xml") ||
    err.includes("parse") ||
    err.includes("syntaxerror") ||
    err.includes("invalid xml") ||
    err.includes("unexpected token") ||
    err.includes("non-whitespace before first tag") ||
    err.includes("not a valid feed")
  ) {
    return {
      category: "Feed Format / Parsing Failure",
      badgeVariant: "destructive",
      summary: "The response returned by the source could not be parsed as valid RSS, Atom, or JSON.",
      remediation:
        "Verify the source format matches the connector type. The source may be returning HTML error pages instead of valid feed XML.",
    };
  }

  if (err.includes("database") || err.includes("drizzle") || err.includes("postgres") || err.includes("sql")) {
    return {
      category: "Database Ingestion Error",
      badgeVariant: "destructive",
      summary: "An error occurred while inserting or updating normalized items in the database.",
      remediation:
        "Inspect database constraints, migrations, or check server logs for specific SQL constraint violations.",
    };
  }

  return {
    category: "Execution Pipeline Failure",
    badgeVariant: "destructive",
    summary: "An unhandled exception was thrown during the sync or item normalization process.",
    remediation:
      "Review the untruncated error message below and inspect server logs around the job start time for full context.",
  };
}

function JobsContent() {
  const searchParams = useSearchParams();
  const { can, loading: permsLoading } = usePermissions();

  const paramTab = searchParams.get("tab");
  const paramJobId = searchParams.get("jobId");
  const paramSub = searchParams.get("sub");
  const initialSub = paramSub || (paramJobId ? `/queue/ingest/${encodeURIComponent(paramJobId)}` : "");
  const initialTab = paramTab === "bull-board" ? "bull-board" : "sync-runs";

  const [tab, setTab] = useState<"sync-runs" | "bull-board">(initialTab);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [boardUrl, setBoardUrl] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardSubPath, setBoardSubPath] = useState<string>(initialSub);

  // Detail Modal & Action states
  const [selectedRun, setSelectedRun] = useState<SyncRun | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const { isVisible, toggleColumn, resetColumns, visibleCount } = useColumnVisibility(
    "jobs_sync_runs",
    SYNC_RUN_COLUMNS,
  );

  const load = useCallback(() => {
    if (!can("jobs", "read")) return;
    setLoading(true);
    api.syncRuns
      .list({
        status: status || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      .then((d) => {
        setRuns(d.runs);
        setTotalCount(d.count);
      })
      .finally(() => setLoading(false));
  }, [can, status, page, pageSize]);

  const loadBullBoard = useCallback(async (targetSubPath?: string) => {
    setBoardLoading(true);
    try {
      const sub = targetSubPath !== undefined ? targetSubPath : boardSubPath;
      const url = await bullBoardUrl(sub);
      setBoardUrl(url);
    } finally {
      setBoardLoading(false);
    }
  }, [boardSubPath]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "bull-board") {
      loadBullBoard();
    }
  }, [tab, loadBullBoard]);

  useEffect(() => {
    const t = searchParams.get("tab");
    const jId = searchParams.get("jobId");
    const s = searchParams.get("sub");
    if (t === "bull-board") {
      setTab("bull-board");
      const target = s || (jId ? `/queue/ingest/${encodeURIComponent(jId)}` : "");
      if (target && target !== boardSubPath) {
        setBoardSubPath(target);
        loadBullBoard(target);
      }
    }
  }, [searchParams, loadBullBoard, boardSubPath]);

  const handleRetry = async (sourceId: string, sourceName?: string) => {
    setRetryingId(sourceId);
    try {
      await api.sources.run(sourceId);
      toast.success(`Sync scheduled for ${sourceName || "source"}`);
      setTimeout(() => {
        load();
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to trigger sync");
    } finally {
      setRetryingId(null);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  if (!permsLoading && !can("jobs", "read")) {
    return <AccessDenied feature="Jobs & Queues" />;
  }

  const diagnostic = selectedRun ? getErrorDiagnostic(selectedRun.error) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="Sync audit trail, detailed error diagnostics, and BullMQ telemetry"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60 w-fit">
          <button
            type="button"
            onClick={() => setTab("sync-runs")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
              tab === "sync-runs"
                ? "bg-background text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListFilter size={14} className={tab === "sync-runs" ? "text-primary" : undefined} />
            <span>Sync Runs</span>
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {totalCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("bull-board")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
              tab === "bull-board"
                ? "bg-background text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Layers size={14} className={tab === "bull-board" ? "text-primary" : undefined} />
            <span>Bull Board</span>
          </button>
        </div>

        {tab === "sync-runs" && (
          <div className="flex items-center gap-3">
            <Select
              value={status || "all"}
              onValueChange={(val) => {
                setStatus(val === "all" ? "" : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ok">OK only</SelectItem>
                <SelectItem value="error">Errors only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load} disabled={loading} className="cursor-pointer">
              <RefreshCw size={13} className={cn("mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <ColumnVisibilityDropdown
              columns={SYNC_RUN_COLUMNS}
              isVisible={isVisible}
              onToggle={toggleColumn}
              onReset={resetColumns}
            />
          </div>
        )}

        {tab === "bull-board" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/60 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setBoardSubPath("");
                  loadBullBoard("");
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs",
                  boardSubPath === "" ? "bg-background shadow-xs font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Queues
              </button>
              <button
                type="button"
                onClick={() => {
                  setBoardSubPath("/queue/ingest");
                  loadBullBoard("/queue/ingest");
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs",
                  boardSubPath === "/queue/ingest" ? "bg-background shadow-xs font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Ingest
              </button>
              <button
                type="button"
                onClick={() => {
                  setBoardSubPath("/queue/ingest?status=failed");
                  loadBullBoard("/queue/ingest?status=failed");
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs",
                  boardSubPath === "/queue/ingest?status=failed" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Ingest (Failed)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBoardSubPath("/queue/pipeline");
                  loadBullBoard("/queue/pipeline");
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs",
                  boardSubPath === "/queue/pipeline" ? "bg-background shadow-xs font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Pipeline
              </button>
              <button
                type="button"
                onClick={() => {
                  setBoardSubPath("/queue/pipeline?status=failed");
                  loadBullBoard("/queue/pipeline?status=failed");
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs",
                  boardSubPath === "/queue/pipeline?status=failed" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Pipeline (Failed)
              </button>
              {boardSubPath.startsWith("/queue/ingest/") && boardSubPath !== "/queue/ingest" && (
                <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-xs truncate max-w-44">
                  Job: {decodeURIComponent(boardSubPath.replace("/queue/ingest/", ""))}
                </span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBullBoard()}
              disabled={boardLoading}
              className="cursor-pointer text-xs"
            >
              <RefreshCw size={13} className={cn("mr-1.5", boardLoading && "animate-spin")} />
              {boardLoading ? "Refreshing…" : "Refresh"}
            </Button>
            {boardUrl && (
              <a
                href={boardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
              >
                <ExternalLink size={13} className="text-primary" />
                <span>Open external</span>
              </a>
            )}
          </div>
        )}
      </div>

      {tab === "sync-runs" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-175">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {isVisible("source") && <Th>Source</Th>}
                  {isVisible("status") && <Th>Status</Th>}
                  {isVisible("found") && <Th>Found</Th>}
                  {isVisible("new") && <Th>New</Th>}
                  {isVisible("duration") && <Th>Duration</Th>}
                  {isVisible("detail") && <Th>Detail</Th>}
                  {isVisible("started") && <Th>Started</Th>}
                  {isVisible("actions") && <Th className="text-right">Actions</Th>}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const isError = r.status === "error";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setShowRawJson(false);
                        setSelectedRun(r);
                      }}
                      className={cn(
                        "border-b border-border/60 last:border-0 cursor-pointer transition-colors group",
                        isError
                          ? "hover:bg-rose-500/10 bg-rose-500/5 dark:bg-rose-950/20"
                          : "hover:bg-muted/40",
                      )}
                    >
                      {isVisible("source") && (
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "w-1.5 h-6 rounded-full shrink-0",
                                isError ? "bg-rose-500" : "bg-emerald-500",
                              )}
                            />
                            <div>
                              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {r.sourceName}
                              </span>
                              <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                                {r.sourceType}
                              </span>
                            </div>
                          </div>
                        </Td>
                      )}
                      {isVisible("status") && (
                        <Td>
                          <Badge variant={isError ? "destructive" : "success"}>
                            {r.status}
                          </Badge>
                        </Td>
                      )}
                      {isVisible("found") && (
                        <Td className="font-mono text-xs text-muted-foreground">{r.itemsFound}</Td>
                      )}
                      {isVisible("new") && (
                        <Td className="font-mono text-xs text-muted-foreground">{r.itemsNew}</Td>
                      )}
                      {isVisible("duration") && (
                        <Td className="font-mono text-xs text-muted-foreground">
                          {formatDuration(r.startedAt, r.finishedAt)}
                        </Td>
                      )}
                      {isVisible("detail") && (
                        <Td className="max-w-65 truncate text-xs">
                          {isError ? (
                            <span className="text-rose-600 dark:text-rose-400 font-medium truncate block" title={r.error ?? undefined}>
                              {r.error ?? "Failed with unspecified error"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Td>
                      )}
                      {isVisible("started") && (
                        <Td className="text-xs text-muted-foreground whitespace-nowrap">
                          <div>{new Date(r.startedAt).toLocaleTimeString()}</div>
                          <div className="text-[10px] text-muted-foreground/70">
                            {formatRelativeTime(r.startedAt)}
                          </div>
                        </Td>
                      )}
                      {isVisible("actions") && (
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRawJson(false);
                                setSelectedRun(r);
                              }}
                              className="h-7 px-2 text-xs gap-1 cursor-pointer text-muted-foreground hover:text-foreground"
                              title="Inspect job run"
                            >
                              <Eye size={13} />
                              <span className="hidden sm:inline">Inspect</span>
                            </Button>
                            {(can("sources", "write") || can("jobs", "write")) && (
                              <Button
                                variant={isError ? "outline" : "ghost"}
                                size="xs"
                                disabled={retryingId === r.sourceId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRetry(r.sourceId, r.sourceName);
                                }}
                                className={cn(
                                  "h-7 px-2 text-xs gap-1 cursor-pointer",
                                  isError
                                    ? "border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                title="Retry this sync job"
                              >
                                <RefreshCw
                                  size={12}
                                  className={cn(retryingId === r.sourceId && "animate-spin")}
                                />
                                <span className="hidden sm:inline">Retry</span>
                              </Button>
                            )}
                          </div>
                        </Td>
                      )}
                    </tr>
                  );
                })}
                {runs.length === 0 ? (
                  <tr>
                    <Td colSpan={visibleCount} className="py-8 text-center text-muted-foreground">
                      No runs recorded.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/60 p-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              pageSizeOptions={[10, 25, 50]}
              disabled={loading}
            />
          </div>
        </Card>
      ) : (
        <div>
          {boardUrl ? (
            <Card className="overflow-hidden border border-border shadow-xs">
              <iframe
                key={boardUrl}
                src={boardUrl}
                title="Bull Board"
                className="h-187.5 w-full bg-card"
              />
            </Card>
          ) : (
            <Card className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading Bull Board…
            </Card>
          )}
        </div>
      )}

      {/* Sync Run Details Modal */}
      {selectedRun && diagnostic && (
        <Modal
          isOpen={Boolean(selectedRun)}
          onClose={() => setSelectedRun(null)}
          title="Sync Run Details"
          className="max-w-2xl sm:max-w-3xl"
        >
          <div className="space-y-5">
            {/* Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant={selectedRun.status === "ok" ? "success" : "destructive"}
                  className="px-2.5 py-1 text-xs font-semibold gap-1.5"
                >
                  {selectedRun.status === "ok" ? (
                    <CheckCircle2 size={13} className="text-emerald-500" />
                  ) : (
                    <AlertCircle size={13} className="text-rose-500" />
                  )}
                  <span className="uppercase">{selectedRun.status}</span>
                </Badge>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-base">
                      {selectedRun.sourceName || "Source"}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                      {selectedRun.sourceType}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background border border-border px-2.5 py-1 rounded-lg">
                  <Clock size={12} className="text-primary" />
                  {formatDuration(selectedRun.startedAt, selectedRun.finishedAt)}
                </span>
              </div>
            </div>

            {/* Metrics 4-grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Items Found
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {selectedRun.itemsFound}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Items Ingested (New)
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedRun.itemsNew}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Total Duration
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {formatDuration(selectedRun.startedAt, selectedRun.finishedAt)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Execution Time
                </div>
                <div className="mt-1.5 text-xs font-semibold text-foreground truncate">
                  {formatRelativeTime(selectedRun.finishedAt || selectedRun.startedAt)}
                </div>
              </div>
            </div>

            {/* Error Diagnostics Section (if error present) */}
            {selectedRun.error && (
              <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 dark:bg-rose-950/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={17} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                        {diagnostic.category}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleCopy(selectedRun.error ?? "", "error")}
                    className="h-7 text-xs gap-1 cursor-pointer hover:bg-rose-500/10"
                  >
                    {copiedKey === "error" ? (
                      <>
                        <Check size={12} className="text-emerald-500" />
                        <span className="text-emerald-500 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Error</span>
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs font-medium text-foreground/90 leading-relaxed">
                  {diagnostic.summary}
                </p>

                <div className="rounded-xl border border-border/60 bg-muted/60 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Troubleshooting Advice: </span>
                  {diagnostic.remediation}
                </div>

                <div className="pt-1">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Untruncated Error Message & Stack
                  </div>
                  <pre className="max-h-52 overflow-y-auto rounded-xl bg-neutral-950 p-3 text-[11px] font-mono text-rose-300 whitespace-pre-wrap break-all select-all border border-rose-900/30">
                    {selectedRun.error}
                  </pre>
                </div>
              </div>
            )}

            {/* Metadata & Timestamps */}
            <div className="rounded-2xl border border-border bg-card p-4 text-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">
                    Started At
                  </span>
                  <span className="font-medium text-foreground">
                    {new Date(selectedRun.startedAt).toLocaleString()} ({formatRelativeTime(selectedRun.startedAt)})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">
                    Finished At
                  </span>
                  <span className="font-medium text-foreground">
                    {selectedRun.finishedAt
                      ? `${new Date(selectedRun.finishedAt).toLocaleString()} (${formatRelativeTime(selectedRun.finishedAt)})`
                      : "In progress / Pending"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">
                    Run ID
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px] truncate max-w-55">
                      {selectedRun.id}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedRun.id, "runId")}
                      className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                      title="Copy Run ID"
                    >
                      {copiedKey === "runId" ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">
                    Source ID
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px] truncate max-w-55">
                      {selectedRun.sourceId}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedRun.sourceId, "sourceId")}
                      className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                      title="Copy Source ID"
                    >
                      {copiedKey === "sourceId" ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
                {selectedRun.jobId && (
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider">
                      BullMQ Job ID
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <code className="font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px] truncate max-w-55">
                        {selectedRun.jobId}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedRun.jobId!, "jobId")}
                        className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                        title="Copy Job ID"
                      >
                        {copiedKey === "jobId" ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              {(can("sources", "write") || can("jobs", "write")) && (
                <Button
                  onClick={() => handleRetry(selectedRun.sourceId, selectedRun.sourceName)}
                  disabled={retryingId === selectedRun.sourceId}
                  className="gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    size={14}
                    className={cn(retryingId === selectedRun.sourceId && "animate-spin")}
                  />
                  <span>
                    {retryingId === selectedRun.sourceId ? "Scheduling Retry…" : "Retry Job Now"}
                  </span>
                </Button>
              )}

              <Link
                href={`/logs?q=${encodeURIComponent(selectedRun.sourceName || selectedRun.sourceId)}&service=worker&sourceId=${encodeURIComponent(selectedRun.sourceId)}${selectedRun.jobId ? `&jobId=${encodeURIComponent(selectedRun.jobId)}` : ""}`}
                className="inline-flex items-center gap-1.5 rounded-4xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Terminal size={14} className="text-primary" />
                <span>View Related Logs</span>
              </Link>

              {can("sources", "read") && (
                <Link
                  href={`/sources/${selectedRun.sourceId}`}
                  className="inline-flex items-center gap-1.5 rounded-4xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Wrench size={14} className="text-amber-500" />
                  <span>Configure Source</span>
                </Link>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const targetSub = selectedRun.jobId
                    ? `/queue/ingest/${encodeURIComponent(selectedRun.jobId)}`
                    : selectedRun.status === "error"
                    ? "/queue/ingest?status=failed"
                    : "/queue/ingest";
                  setBoardSubPath(targetSub);
                  loadBullBoard(targetSub);
                  setSelectedRun(null);
                  setTab("bull-board");
                }}
                className="gap-1.5 cursor-pointer"
              >
                <Layers size={14} className="text-primary" />
                <span>
                  {selectedRun.jobId
                    ? "View Job in Bull Board"
                    : selectedRun.status === "error"
                    ? "View in Bull Board (Failed)"
                    : "View in Bull Board"}
                </span>
              </Button>
            </div>

            {/* Raw JSON Inspector */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full flex items-center justify-between p-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Code size={13} className="text-primary" />
                  <span>View Raw Run JSON</span>
                </span>
                {showRawJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showRawJson && (
                <div className="p-3 pt-0 border-t border-border/60">
                  <div className="flex justify-end py-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleCopy(JSON.stringify(selectedRun, null, 2), "rawJson")}
                      className="h-6 text-xs gap-1 cursor-pointer"
                    >
                      {copiedKey === "rawJson" ? (
                        <>
                          <Check size={11} className="text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="max-h-56 overflow-y-auto rounded-xl bg-neutral-950 p-3 text-[11px] font-mono text-emerald-400 whitespace-pre-wrap select-all border border-border/60">
                    {JSON.stringify(selectedRun, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      }
    >
      <JobsContent />
    </Suspense>
  );
}
