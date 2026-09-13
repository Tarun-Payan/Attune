"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { AdminLogEntryDTO, AdminLogsOverviewDTO } from "@attune/types";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  Td,
  Th,
  useClientPagination,
} from "@/components/ui";

import { cn } from "@/lib/utils";

const SERVICES = [
  { id: "all", label: "All Services" },
  { id: "api", label: "API (apps/api)" },
  { id: "worker", label: "Worker (apps/worker)" },
  { id: "admin", label: "Admin (apps/admin)" },
] as const;

const LEVELS = [
  { id: "all", label: "All Levels" },
  { id: "error", label: "Errors (50+)" },
  { id: "warn", label: "Warnings (40)" },
  { id: "debug", label: "Debug (20)" },
] as const;

const REFRESH_INTERVALS = [
  { label: "Off", value: 0 },
  { label: "Every 2s", value: 2000 },
  { label: "Every 5s", value: 5000 },
  { label: "Every 10s", value: 10000 },
];

function formatLogTime(timeVal: number | string): string {
  try {
    const d = new Date(timeVal);
    if (Number.isNaN(d.getTime())) return String(timeVal);
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const secs = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${hours}:${mins}:${secs}.${ms}`;
  } catch {
    return String(timeVal);
  }
}

function getLevelBadge(level: number, label: string) {
  if (level >= 50) {
    return (
      <Badge variant="destructive" className="font-mono text-[10px] uppercase">
        {label || "error"}
      </Badge>
    );
  }
  if (level === 40) {
    return (
      <Badge variant="warning" className="font-mono text-[10px] uppercase">
        {label || "warn"}
      </Badge>
    );
  }
  if (level === 30) {
    return (
      <Badge variant="info" className="font-mono text-[10px] uppercase">
        {label || "info"}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-mono text-[10px] uppercase">
      {label || "debug"}
    </Badge>
  );
}

function getServiceBadge(service: string) {
  const s = (service || "unknown").toLowerCase();
  if (s === "api") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
        api
      </span>
    );
  }
  if (s === "worker") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
        worker
      </span>
    );
  }
  if (s === "admin") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
        admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
      {service}
    </span>
  );
}

function LogsContent() {
  const searchParams = useSearchParams();
  const { can, loading: permsLoading } = usePermissions();

  // Data state
  const [data, setData] = useState<AdminLogsOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  // Sync URL search parameters on mount or when searchParams change
  useEffect(() => {
    const qParam = searchParams.get("q");
    const serviceParam = searchParams.get("service");
    const levelParam = searchParams.get("level");
    const requestIdParam = searchParams.get("requestId");
    const jobIdParam = searchParams.get("jobId");
    const runIdParam = searchParams.get("runId");
    const userIdParam = searchParams.get("userId");
    const sourceIdParam = searchParams.get("sourceId");

    if (qParam !== null) setSearchQuery(qParam);
    if (serviceParam !== null) setServiceFilter(serviceParam);
    if (levelParam !== null) setLevelFilter(levelParam);
    if (requestIdParam !== null) setActiveRequestId(requestIdParam);
    if (jobIdParam !== null) setActiveJobId(jobIdParam);
    if (runIdParam !== null) setActiveRunId(runIdParam);
    if (userIdParam !== null) setActiveUserId(userIdParam);
    if (sourceIdParam !== null) setActiveSourceId(sourceIdParam);
  }, [searchParams]);

  // Auto-refresh interval (in ms)
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modal inspection
  const [inspectLog, setInspectLog] = useState<AdminLogEntryDTO | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Clear modal
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Client pagination
  const allLogs = useMemo(() => data?.logs ?? [], [data]);
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    paginatedItems: paginatedLogs,
  } = useClientPagination(allLogs, 25);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [serviceFilter, levelFilter, searchQuery, activeRequestId, activeJobId, activeRunId, activeUserId, activeSourceId, setPage]);

  // Fetch logs from API
  const fetchLogs = useCallback(
    async (isBackground = false) => {
      if (!can("logs", "read")) return;
      if (!isBackground) setRefreshing(true);

      try {
        const res = await api.logs.list({
          service: serviceFilter !== "all" ? serviceFilter : undefined,
          level: levelFilter !== "all" ? levelFilter : undefined,
          q: searchQuery.trim() || undefined,
          requestId: activeRequestId || undefined,
          jobId: activeJobId || undefined,
          runId: activeRunId || undefined,
          userId: activeUserId || undefined,
          sourceId: activeSourceId || undefined,
          limit: 200,
        });
        setData(res);
      } catch (err: unknown) {
        if (!isBackground) {
          toast.error("Failed to load logs", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [can, serviceFilter, levelFilter, searchQuery, activeRequestId, activeJobId, activeRunId, activeUserId, activeSourceId]
  );

  // Initial load & when filters change
  useEffect(() => {
    if (!permsLoading) {
      fetchLogs();
    }
  }, [permsLoading, fetchLogs]);

  // Auto-refresh timer
  useEffect(() => {
    if (refreshInterval <= 0) {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      return;
    }

    refreshTimerRef.current = setInterval(() => {
      fetchLogs(true);
    }, refreshInterval);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [refreshInterval, fetchLogs]);

  // Handle Clear Buffer
  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const res = await api.logs.clear();
      toast.success("Log buffer cleared", {
        description: `Removed ${res.deletedCount} log entries from memory buffer.`,
      });
      setClearModalOpen(false);
      await fetchLogs();
    } catch (err: unknown) {
      toast.error("Failed to clear log buffer", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setClearing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (permsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!can("logs", "read")) {
    return <AccessDenied feature="System Logs" />;
  }

  const errorCount = allLogs.filter((l) => l.level >= 50).length;
  const warnCount = allLogs.filter((l) => l.level === 40).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="System Logs"
        subtitle="Structured in-memory log buffer from API, Worker, and Admin services."
        action={

          <div className="flex flex-wrap items-center gap-2">
            {/* Auto Refresh Select */}
            <Select
              value={String(refreshInterval)}
              onValueChange={(val) => setRefreshInterval(Number(val))}
            >
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <Clock className="size-3.5 text-muted-foreground mr-1 shrink-0" />
                <SelectValue placeholder="Auto-refresh" />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_INTERVALS.map((int) => (
                  <SelectItem key={int.value} value={String(int.value)}>
                    {int.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs()}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              <span>Refresh</span>
            </Button>

            {/* Clear Logs Button */}
            {can("logs", "write") && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setClearModalOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Buffer</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Buffer Capacity
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            {data ? data.totalInBuffer : 0}
            <span className="text-xs font-normal text-muted-foreground ml-1 font-mono">
              / {data?.maxCache ?? 2000} (MAX_LOG_CACHE)
            </span>
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            Capped Redis in-memory list
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Matching Filter
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Filter size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            {data ? data.count : 0}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Entries returned for inspection
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Errors in Buffer
            </span>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl",
                errorCount > 0
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-500/10 text-emerald-500"
              )}
            >
              <AlertCircle size={16} />
            </div>
          </div>
          <div
            className={cn(
              "mt-2 text-2xl font-bold tracking-tight",
              errorCount > 0 ? "text-destructive" : "text-foreground"
            )}
          >
            {errorCount}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {errorCount > 0 ? "Issues requiring attention" : "No recent errors detected"}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Warnings
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Clock size={16} />
            </div>
          </div>
          <div
            className={cn(
              "mt-2 text-2xl font-bold tracking-tight",
              warnCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
            )}
          >
            {warnCount}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Degraded runs or soft failures
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by keyword, message, user ID, component..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Service Filter Tabs */}
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border text-xs font-medium">
              {SERVICES.map((srv) => (
                <button
                  key={srv.id}
                  onClick={() => setServiceFilter(srv.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-colors",
                    serviceFilter === srv.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {srv.label}
                </button>
              ))}
            </div>

            {/* Level Filter Dropdown */}
            <Select
              value={levelFilter}
              onValueChange={(val) => setLevelFilter(val)}
            >
              <SelectTrigger className="h-9 w-38 text-xs">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((lvl) => (
                  <SelectItem key={lvl.id} value={lvl.id}>
                    {lvl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>


        {/* Active Correlation Filter Badges (e.g. Filtered by Request ID / User ID / Source ID) */}
        {(activeRequestId || activeJobId || activeRunId || activeUserId || activeSourceId) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs">
            <span className="text-muted-foreground font-medium">Trace Filters:</span>
            {activeSourceId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-mono text-[11px]">
                <span>sourceId: {activeSourceId}</span>
                <button
                  onClick={() => setActiveSourceId(null)}
                  className="hover:text-emerald-700/70 dark:hover:text-emerald-300/70 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeUserId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-mono text-[11px]">
                <span>user: {activeUserId}</span>
                <button
                  onClick={() => setActiveUserId(null)}
                  className="hover:text-purple-700/70 dark:hover:text-purple-300/70 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeRequestId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono text-[11px]">
                <span>requestId: {activeRequestId}</span>
                <button
                  onClick={() => setActiveRequestId(null)}
                  className="hover:text-primary/70 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeJobId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono text-[11px]">
                <span>jobId: {activeJobId}</span>
                <button
                  onClick={() => setActiveJobId(null)}
                  className="hover:text-amber-700/70 dark:hover:text-amber-400/70 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeRunId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-mono text-[11px]">
                <span>runId: {activeRunId}</span>
                <button
                  onClick={() => setActiveRunId(null)}
                  className="hover:text-blue-700/70 dark:hover:text-blue-400/70 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveRequestId(null);
                setActiveJobId(null);
                setActiveRunId(null);
                setActiveUserId(null);
                setActiveSourceId(null);
              }}
              className="h-6 px-2 text-[11px] cursor-pointer"
            >
              Clear Trace Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Logs Table */}
      <Card className="overflow-hidden shadow-xs">
        <Table>
          <thead>
            <tr className="border-b bg-muted/40">
              <Th className="w-[120px]">Time</Th>
              <Th className="w-[80px]">Level</Th>
              <Th className="w-[90px]">Service</Th>
              <Th>Message</Th>
              <Th className="w-[200px]">Correlation IDs</Th>
              <Th className="w-[80px] text-right">Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <Td colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Spinner className="h-6 w-6 text-primary" />
                    <span className="text-xs text-muted-foreground">Loading recent logs...</span>
                  </div>
                </Td>
              </tr>
            ) : paginatedLogs.length === 0 ? (
              <tr>
                <Td colSpan={6} className="h-48 text-center text-muted-foreground text-sm">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Terminal className="w-8 h-8 text-muted-foreground/50" />
                    <span>No log entries match the selected filters.</span>
                    {(searchQuery ||
                      serviceFilter !== "all" ||
                      levelFilter !== "all" ||
                      activeRequestId ||
                      activeJobId ||
                      activeRunId ||
                      activeUserId) && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("");
                          setServiceFilter("all");
                          setLevelFilter("all");
                          setActiveRequestId(null);
                          setActiveJobId(null);
                          setActiveRunId(null);
                          setActiveUserId(null);
                        }}
                      >
                        Reset all filters
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ) : (
              paginatedLogs.map((log, idx) => {
                const isError = log.level >= 50;
                return (
                  <tr
                    key={`${log.time}-${idx}`}
                    className={cn(
                      "hover:bg-muted/40 transition-colors group cursor-pointer",
                      isError && "bg-destructive/5 dark:bg-destructive/10"
                    )}
                    onClick={() => setInspectLog(log)}
                  >
                    {/* Timestamp */}
                    <Td className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatLogTime(log.time)}
                    </Td>

                    {/* Level */}
                    <Td>{getLevelBadge(log.level, log.levelLabel)}</Td>

                    {/* Service */}
                    <Td>{getServiceBadge(log.service)}</Td>

                    {/* Message */}
                    <Td>
                      <div className="flex flex-col gap-1 max-w-[550px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.method && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-muted border">
                              {log.method}
                            </span>
                          )}
                          {log.statusCode && (
                            <span
                              className={cn(
                                "text-[10px] font-mono font-semibold",
                                log.statusCode >= 500
                                  ? "text-destructive"
                                  : log.statusCode >= 400
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {log.statusCode}
                            </span>
                          )}
                          {log.responseTime !== undefined && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {log.responseTime}ms
                            </span>
                          )}
                          <span
                            className={cn(
                              "text-xs font-mono truncate",
                              isError ? "text-destructive font-medium" : "text-foreground"
                            )}
                            title={log.msg}
                          >
                            {log.msg || "(no message)"}
                          </span>
                        </div>
                        {log.err?.message && (
                          <span className="text-[11px] text-destructive/80 font-mono truncate">
                            Error: {log.err.message}
                          </span>
                        )}
                      </div>
                    </Td>

                    {/* Correlation IDs */}
                    <Td onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1 text-[11px] font-mono">
                        {log.userId && (
                          <button
                            type="button"
                            onClick={() => setActiveUserId(log.userId ?? null)}
                            className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline truncate text-left"
                            title={`Filter by userId: ${log.userId}`}
                          >
                            <span className="text-muted-foreground">user:</span>
                            <span className="truncate">{log.userId.slice(0, 14)}...</span>
                          </button>
                        )}
                        {log.requestId && (
                          <button
                            type="button"
                            onClick={() => setActiveRequestId(log.requestId ?? null)}
                            className="inline-flex items-center gap-1 text-primary hover:underline truncate text-left"
                            title={`Filter by requestId: ${log.requestId}`}
                          >
                            <span className="text-muted-foreground">req:</span>
                            <span className="truncate">{log.requestId.slice(0, 16)}...</span>
                          </button>
                        )}
                        {log.jobId && (
                          <button
                            type="button"
                            onClick={() => setActiveJobId(String(log.jobId))}
                            className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline truncate text-left"
                            title={`Filter by jobId: ${log.jobId}`}
                          >
                            <span className="text-muted-foreground">job:</span>
                            <span className="truncate">{String(log.jobId)}</span>
                          </button>
                        )}
                        {log.runId && (
                          <button
                            type="button"
                            onClick={() => setActiveRunId(log.runId ?? null)}
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline truncate text-left"
                            title={`Filter by runId: ${log.runId}`}
                          >
                            <span className="text-muted-foreground">run:</span>
                            <span className="truncate">{log.runId.slice(0, 14)}...</span>
                          </button>
                        )}
                        {!log.requestId && !log.jobId && !log.runId && !log.userId && (
                          <span className="text-muted-foreground/60 text-[10px]">-</span>
                        )}
                      </div>
                    </Td>

                    {/* Actions */}
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setInspectLog(log)}
                        title="Inspect full JSON"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>

        {/* Pagination Bar */}
        {allLogs.length > 0 && (
          <div className="p-3 border-t">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[15, 25, 50, 100]}
            />
          </div>
        )}
      </Card>

      {/* Inspect Log Entry Modal */}
      <Modal
        isOpen={Boolean(inspectLog)}
        onClose={() => setInspectLog(null)}
        title="Log Entry Details"
        className="max-w-3xl"
      >

        {inspectLog && (
          <div className="space-y-4">
            {/* Meta header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-muted/40 p-3 rounded-lg border">
              <div>
                <span className="text-muted-foreground block">Service</span>
                <span className="font-semibold">{inspectLog.service}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Level</span>
                <span>{getLevelBadge(inspectLog.level, inspectLog.levelLabel)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Time</span>
                <span className="font-mono">{formatLogTime(inspectLog.time)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Environment</span>
                <span className="font-mono">{inspectLog.environment || "production"}</span>
              </div>
            </div>

            {/* Quick Correlation Trace Buttons */}
            <div className="flex flex-wrap gap-2 text-xs">
              {inspectLog.userId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveUserId(inspectLog.userId ?? null);
                    setInspectLog(null);
                  }}
                  className="gap-1.5 text-xs font-mono text-purple-600 dark:text-purple-400 border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10"
                >
                  <Filter className="w-3 h-3" />
                  <span>Filter by User ID ({inspectLog.userId.slice(0, 10)}...)</span>
                </Button>
              )}
              {inspectLog.requestId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveRequestId(inspectLog.requestId ?? null);
                    setInspectLog(null);
                  }}
                  className="gap-1.5 text-xs font-mono"
                >
                  <Filter className="w-3 h-3" />
                  <span>Filter by Request ID ({inspectLog.requestId.slice(0, 10)}...)</span>
                </Button>
              )}
              {inspectLog.jobId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveJobId(String(inspectLog.jobId));
                    setInspectLog(null);
                  }}
                  className="gap-1.5 text-xs font-mono"
                >
                  <Filter className="w-3 h-3" />
                  <span>Filter by Job ID ({String(inspectLog.jobId)})</span>
                </Button>
              )}
              {inspectLog.runId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveRunId(inspectLog.runId ?? null);
                    setInspectLog(null);
                  }}
                  className="gap-1.5 text-xs font-mono"
                >
                  <Filter className="w-3 h-3" />
                  <span>Filter by Run ID ({inspectLog.runId.slice(0, 10)}...)</span>
                </Button>
              )}
            </div>

            {/* User Context & Direct View Action */}
            {inspectLog.userId && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-purple-700 dark:text-purple-300">
                      <User className="w-3.5 h-3.5" />
                      <span>User Context</span>
                    </div>
                    {inspectLog.userRole && (
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {inspectLog.userRole}
                      </Badge>
                    )}
                    {inspectLog.adminRole && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300">
                        {inspectLog.adminRole}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => {
                        setActiveUserId(inspectLog.userId ?? null);
                        setInspectLog(null);
                      }}
                    >
                      <Filter className="w-3 h-3" />
                      <span>Filter User Logs</span>
                    </Button>
                    <Link
                      href={`/users?q=${encodeURIComponent(inspectLog.userId)}`}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>View User Profile</span>
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground pt-1 border-t border-purple-500/10">
                  <div className="flex items-center gap-1">
                    <span>ID:</span>
                    <strong className="text-foreground select-all">{inspectLog.userId}</strong>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => copyToClipboard(String(inspectLog.userId), "user-id")}
                      title="Copy User ID"
                    >
                      {copiedKey === "user-id" ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {inspectLog.ip && (
                    <div className="flex items-center gap-1">
                      <span>IP:</span>
                      <strong className="text-foreground">{inspectLog.ip}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Request Details */}
            {(inspectLog.method || inspectLog.url || inspectLog.statusCode) && (
              <div className="bg-muted/40 border rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {inspectLog.method && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted border">
                        {inspectLog.method}
                      </span>
                    )}
                    {inspectLog.url && (
                      <span className="font-mono font-medium text-foreground truncate max-w-[420px]" title={inspectLog.url}>
                        {inspectLog.url}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inspectLog.statusCode && (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-mono font-bold",
                          inspectLog.statusCode >= 500
                            ? "bg-destructive/10 text-destructive"
                            : inspectLog.statusCode >= 400
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {inspectLog.statusCode}
                      </span>
                    )}
                    {inspectLog.responseTime !== undefined && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {inspectLog.responseTime}ms
                      </span>
                    )}
                  </div>
                </div>

                {(inspectLog.ip || inspectLog.userAgent) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1.5 border-t text-muted-foreground">
                    {inspectLog.ip && (
                      <div>
                        <span>Client IP: </span>
                        <span className="font-mono text-foreground">{inspectLog.ip}</span>
                      </div>
                    )}
                    {inspectLog.userAgent && (
                      <div className="truncate" title={inspectLog.userAgent}>
                        <span>User-Agent: </span>
                        <span className="font-mono text-foreground truncate">{inspectLog.userAgent}</span>
                      </div>
                    )}
                  </div>
                )}

                {inspectLog.query && Object.keys(inspectLog.query).length > 0 && (
                  <div className="pt-1.5 border-t text-xs">
                    <span className="text-muted-foreground block text-[11px] mb-1 font-medium">Query Parameters:</span>
                    <pre className="bg-background/80 p-2 rounded text-[11px] font-mono border overflow-x-auto">
                      {JSON.stringify(inspectLog.query, null, 2)}
                    </pre>
                  </div>
                )}

                {inspectLog.params && Object.keys(inspectLog.params).length > 0 && (
                  <div className="pt-1.5 border-t text-xs">
                    <span className="text-muted-foreground block text-[11px] mb-1 font-medium">Route Parameters:</span>
                    <pre className="bg-background/80 p-2 rounded text-[11px] font-mono border overflow-x-auto">
                      {JSON.stringify(inspectLog.params, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Error Stack Trace Box (if error exists) */}
            {inspectLog.err && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-destructive">
                  <span>Stack Trace</span>
                  {inspectLog.err.stack && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() =>
                        copyToClipboard(String(inspectLog.err?.stack), "err-stack")
                      }
                    >
                      {copiedKey === "err-stack" ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy Stack</span>
                    </Button>
                  )}
                </div>
                <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap select-text">
                  <div className="font-bold mb-1">
                    {String(inspectLog.err.name || "Error")}: {String(inspectLog.err.message || "")}
                  </div>
                  {String(inspectLog.err.stack ?? "")}
                </div>
              </div>
            )}

            {/* Full JSON Viewer */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Raw JSON Payload</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() =>
                    copyToClipboard(JSON.stringify(inspectLog, null, 2), "raw-json")
                  }
                >
                  {copiedKey === "raw-json" ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copy JSON</span>
                </Button>
              </div>
              <pre className="bg-muted p-3.5 rounded-lg text-xs font-mono max-h-72 overflow-y-auto text-foreground select-text border leading-relaxed">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear Buffer Confirmation Modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Clear Log Buffer"
        className="max-w-md"
      >

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will immediately remove all cached log lines from Redis. Note that this does{" "}
            <strong>not</strong> delete logs from stdout or Railway persistent log storage; it only
            resets the in-memory buffer shown in this admin dashboard.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setClearModalOpen(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearLogs}
              disabled={clearing}
              className="gap-1.5"
            >
              {clearing ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              <span>Clear Buffer</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      }
    >
      <LogsContent />
    </Suspense>
  );
}
