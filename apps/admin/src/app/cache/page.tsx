"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Database,
  Eye,
  Flame,
  HardDrive,
  RefreshCw,
  Search,
  Server,
  Trash2,
  Zap,
} from "lucide-react";
import type {
  CacheKeyDetailResponse,
  CacheKeyItem,
  CacheOverviewResponse,
  ClearCacheInput,
} from "@attune/types";
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
  Table,
  Td,
  Th,
  useClientPagination,
} from "@/components/ui";
import { cn } from "@/lib/utils";

const NAMESPACES = [
  { id: "all", label: "All Keys", prefix: "" },
  { id: "topics", label: "Topics", prefix: "attune:cache:topics" },
  { id: "tags", label: "Tags", prefix: "attune:cache:tags" },
  { id: "stats", label: "Stats", prefix: "attune:cache:stats" },
  { id: "feed", label: "Feed", prefix: "attune:cache:feed" },
  { id: "item", label: "Items", prefix: "attune:cache:item" },
  { id: "rateLimit", label: "Rate Limit", prefix: "attune:cache:ratelimit" },
  { id: "queues", label: "BullMQ (Queues)", prefix: "bull" },
] as const;

function formatTtl(ttl: number): { text: string; variant: "default" | "secondary" | "outline" | "destructive" | "warning" } {
  if (ttl === -1) return { text: "No Expiry", variant: "outline" };
  if (ttl === -2) return { text: "Expired", variant: "destructive" };
  if (ttl < 60) return { text: `${ttl}s`, variant: "warning" };
  if (ttl < 3600) return { text: `${Math.floor(ttl / 60)}m ${ttl % 60}s`, variant: "secondary" };
  const hours = Math.floor(ttl / 3600);
  const mins = Math.floor((ttl % 3600) / 60);
  return { text: `${hours}h ${mins}m`, variant: "default" };
}

function formatUptime(uptimeSec: number): string {
  if (uptimeSec < 60) return `${uptimeSec}s`;
  if (uptimeSec < 3600) return `${Math.floor(uptimeSec / 60)}m`;
  const hours = Math.floor(uptimeSec / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h ${Math.floor((uptimeSec % 3600) / 60)}m`;
}

export default function CachePage() {
  const { can, loading: permsLoading } = usePermissions();

  // Overview state
  const [overview, setOverview] = useState<CacheOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Keys table state
  const [keys, setKeys] = useState<CacheKeyItem[]>([]);
  const [totalKeys, setTotalKeys] = useState(0);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [selectedNamespace, setSelectedNamespace] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit] = useState<number>(200);

  // Client-side pagination (10 rows per page default)
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    paginatedItems: paginatedKeys,
  } = useClientPagination(keys, 10);

  useEffect(() => {
    setPage(1);
  }, [selectedNamespace, searchQuery, setPage]);

  // Inspect modal state
  const [inspectKey, setInspectKey] = useState<string | null>(null);
  const [keyDetail, setKeyDetail] = useState<CacheKeyDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copied, setCopied] = useState(false);

  // Flush modal state
  const [flushModalOpen, setFlushModalOpen] = useState(false);
  const [flushTarget, setFlushTarget] = useState<ClearCacheInput["namespace"]>("all");
  const [flushing, setFlushing] = useState(false);

  // Delete key state
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const fetchOverview = useCallback(() => {
    if (!can("cache", "read")) return;
    setLoadingOverview(true);
    api.cache
      .overview()
      .then((data) => setOverview(data))
      .catch((err) => {
        console.error("Failed to load cache overview:", err);
        toast.error("Could not reach Redis cache overview");
      })
      .finally(() => setLoadingOverview(false));
  }, [can]);

  const fetchKeys = useCallback(() => {
    if (!can("cache", "read")) return;
    setLoadingKeys(true);

    const activeNs = NAMESPACES.find((n) => n.id === selectedNamespace);
    const prefix = searchQuery.trim() || activeNs?.prefix || undefined;

    api.cache
      .keys({ prefix, limit })
      .then((data) => {
        setKeys(data.keys);
        setTotalKeys(data.total);
      })
      .catch((err) => {
        console.error("Failed to fetch cache keys:", err);
        toast.error("Failed to load cache keys");
      })
      .finally(() => setLoadingKeys(false));
  }, [can, selectedNamespace, searchQuery, limit]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleInspect = async (key: string) => {
    setInspectKey(key);
    setLoadingDetail(true);
    setKeyDetail(null);
    setCopied(false);
    try {
      const detail = await api.cache.getKey(key);
      setKeyDetail(detail);
    } catch {
      toast.error(`Failed to inspect key ${key}`);
      setInspectKey(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteKey = async (key: string) => {
    if (!can("cache", "write")) {
      toast.error("Permission denied: requires cache:write");
      return;
    }
    setDeletingKey(key);
    try {
      const res = await api.cache.deleteKey(key);
      if (res.deleted) {
        toast.success(`Key evicted from Redis: ${key}`);
        if (inspectKey === key) {
          setInspectKey(null);
        }
        fetchKeys();
        fetchOverview();
      } else {
        toast.info(`Key was already missing or expired`);
      }
    } catch {
      toast.error("Failed to delete cache key");
    } finally {
      setDeletingKey(null);
    }
  };

  const handleConfirmFlush = async () => {
    if (!can("cache", "write")) {
      toast.error("Permission denied: requires cache:write");
      return;
    }
    setFlushing(true);
    try {
      const res = await api.cache.clear({ namespace: flushTarget });
      toast.success(
        `Successfully flushed ${res.deletedCount} keys from namespace '${res.namespace}'`,
      );
      setFlushModalOpen(false);
      fetchOverview();
      fetchKeys();
    } catch {
      toast.error("Failed to flush cache namespace");
    } finally {
      setFlushing(false);
    }
  };

  const handleCopyJson = () => {
    if (!keyDetail) return;
    navigator.clipboard.writeText(JSON.stringify(keyDetail.value, null, 2));
    setCopied(true);
    toast.success("Copied value to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!permsLoading && !can("cache", "read")) {
    return <AccessDenied feature="Cache" />;
  }

  const isBullQueueKey = (key: string) => key.startsWith("bull:");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Redis Cache Console"
          subtitle="Real-time cache health, key namespaces, TTL inspection, and safe eviction"
        />
        <div className="flex items-center gap-2">
          {can("cache", "write") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setFlushTarget("all");
                setFlushModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Flame size={14} />
              Flush Cache
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchOverview();
              fetchKeys();
            }}
            disabled={loadingOverview || loadingKeys}
            className="gap-1.5"
          >
            <RefreshCw size={14} className={cn((loadingOverview || loadingKeys) && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Telemetry Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connection
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Server size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight capitalize">
              {overview?.status ?? "..."}
            </span>
            {overview?.status === "ready" && (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Ping Latency: <strong className="text-foreground">{overview?.latencyMs ?? 0} ms</strong>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Memory Usage
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <HardDrive size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            {overview?.usedMemoryHuman ?? "0 MB"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Peak: <strong className="text-foreground">{overview?.peakMemoryHuman ?? "0 MB"}</strong>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Keys
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Database size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            {overview?.totalKeys.toLocaleString() ?? 0}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Active in DB 0
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Clients
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Zap size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            {overview?.connectedClients ?? 0}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            API & Worker connections
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Redis Version
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            v{overview?.redisVersion ?? "7.x"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Uptime: <strong className="text-foreground">{overview ? formatUptime(overview.uptimeSec) : "0s"}</strong>
          </div>
        </Card>
      </div>

      {/* Namespace Breakdown & Fast Flush Action Cards */}
      <Card className="p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Cache Namespaces & Eviction Actions
            </h2>
            <p className="text-xs text-muted-foreground">
              Select a namespace to inspect its keys or safely evict cached data without disturbing background queues.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {NAMESPACES.filter((n) => n.id !== "all").map((ns) => {
            const count = overview?.namespaceCounts?.[ns.id] ?? 0;
            const isQueues = ns.id === "queues";

            return (
              <div
                key={ns.id}
                onClick={() => {
                  setSelectedNamespace(ns.id);
                  setSearchQuery("");
                }}
                className={cn(
                  "flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-all hover:shadow-sm",
                  selectedNamespace === ns.id
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border bg-muted/20 hover:bg-muted/40",
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {ns.label}
                    </span>
                    {isQueues ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                        Protected
                      </Badge>
                    ) : (
                      can("cache", "write") && (
                        <button
                          type="button"
                          title={`Flush ${ns.label} cache`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFlushTarget(ns.id as ClearCacheInput["namespace"]);
                            setFlushModalOpen(true);
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Flame size={13} />
                        </button>
                      )
                    )}
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight">
                    {count.toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground font-mono truncate">
                  {ns.prefix || "*"}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Key Explorer & Filter Bar */}
      <Card className="p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Key Explorer ({totalKeys.toLocaleString()} matched)
            </h2>
            <p className="text-xs text-muted-foreground">
              Browse keys, examine expiration timers, and preview stored payloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Namespace Filter Tabs */}
            <div className="flex items-center rounded-xl border border-border bg-muted/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedNamespace("all");
                  setSearchQuery("");
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-medium transition-colors",
                  selectedNamespace === "all"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {NAMESPACES.filter((n) => n.id !== "all").map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setSelectedNamespace(n.id);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "rounded-lg px-2 py-1 font-medium transition-colors",
                    selectedNamespace === n.id
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-56">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search prefix or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Keys Table */}
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr className="border-b border-border">
                <Th className="w-[45%]">Key Name</Th>
                <Th>Namespace</Th>
                <Th>Type</Th>
                <Th>TTL (Remaining)</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loadingKeys ? (
                <tr>
                  <Td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <RefreshCw size={18} className="mx-auto animate-spin mb-2 text-primary" />
                    Scanning Redis keys...
                  </Td>
                </tr>
              ) : paginatedKeys.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-12 text-center text-muted-foreground">
                    No keys found matching your criteria.
                  </Td>
                </tr>
              ) : (
                paginatedKeys.map((k) => {
                  const ttlInfo = formatTtl(k.ttl);
                  const isProtected = isBullQueueKey(k.key);

                  return (
                    <tr key={k.key} className="border-b border-border/50 hover:bg-muted/30">
                      <Td className="font-mono text-xs text-foreground max-w-xs truncate">
                        <span title={k.key}>{k.key}</span>
                      </Td>
                      <Td>
                        <Badge variant="outline" className="capitalize text-xs font-normal">
                          {k.namespace}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge variant="secondary" className="font-mono text-xs font-normal">
                          {k.type}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge variant={ttlInfo.variant} className="text-xs">
                          <Clock size={11} className="mr-1" />
                          {ttlInfo.text}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInspect(k.key)}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Eye size={12} />
                            Inspect
                          </Button>
                          {can("cache", "write") && !isProtected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingKey === k.key}
                              onClick={() => handleDeleteKey(k.key)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="Evict key"
                            >
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        {totalCount > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        )}
      </Card>

      {/* Inspect Key Modal */}
      <Modal
        isOpen={Boolean(inspectKey)}
        onClose={() => setInspectKey(null)}
        title="Cache Key Inspector"
        className="max-w-3xl"
      >
        {loadingDetail ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            <RefreshCw size={20} className="animate-spin mr-2 text-primary" />
            Fetching key payload...
          </div>
        ) : keyDetail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-border bg-muted/20 p-3.5 text-xs">
              <div>
                <span className="text-muted-foreground">Key:</span>
                <p className="font-mono font-medium truncate mt-0.5" title={keyDetail.key}>
                  {keyDetail.key}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Namespace:</span>
                <p className="font-semibold capitalize mt-0.5">{keyDetail.namespace}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Data Type:</span>
                <p className="font-mono mt-0.5">{keyDetail.type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">TTL:</span>
                <p className="mt-0.5 font-medium">{formatTtl(keyDetail.ttl).text}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payload Value
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJson}
                  className="h-7 text-xs gap-1.5"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy JSON"}
                </Button>
              </div>
              <div className="max-h-96 overflow-auto rounded-2xl border border-border bg-zinc-950 p-4 font-mono text-xs text-zinc-100 dark:bg-zinc-900">
                <pre>{JSON.stringify(keyDetail.value, null, 2)}</pre>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              {can("cache", "write") && !isBullQueueKey(keyDetail.key) ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingKey === keyDetail.key}
                  onClick={() => handleDeleteKey(keyDetail.key)}
                  className="gap-1.5"
                >
                  <Trash2 size={13} />
                  Evict This Key
                </Button>
              ) : (
                <div />
              )}
              <Button variant="outline" size="sm" onClick={() => setInspectKey(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Key not found or expired.</div>
        )}
      </Modal>

      {/* Flush Namespace Modal */}
      <Modal
        isOpen={flushModalOpen}
        onClose={() => setFlushModalOpen(false)}
        title="Evict Cache Namespace"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-foreground">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-destructive">Caution: Cache Eviction</p>
                <p className="mt-1 text-muted-foreground">
                  Evicting keys from this namespace will remove all cached queries and force the API
                  to fetch fresh data directly from PostgreSQL on next access.
                </p>
                <p className="mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Safety Guarantee: Active BullMQ job queues and worker states are strictly protected
                  and will NOT be touched.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Target Namespace
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "all", label: "All App Cache", desc: "attune:cache:*" },
                { id: "topics", label: "Topics", desc: "attune:cache:topics:*" },
                { id: "tags", label: "Tags", desc: "attune:cache:tags:*" },
                { id: "stats", label: "Dashboard Stats", desc: "attune:cache:stats:*" },
                { id: "feed", label: "Feed Ingestion", desc: "attune:cache:feed:*" },
                { id: "item", label: "Content Items", desc: "attune:cache:item:*" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFlushTarget(opt.id as ClearCacheInput["namespace"])}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                    flushTarget === opt.id
                      ? "border-destructive bg-destructive/10"
                      : "border-border bg-muted/20 hover:bg-muted/40",
                  )}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFlushModalOpen(false)}
              disabled={flushing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={flushing}
              onClick={handleConfirmFlush}
              className="gap-1.5"
            >
              <Flame size={14} className={cn(flushing && "animate-spin")} />
              {flushing ? "Evicting..." : `Confirm Eviction (${flushTarget})`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
