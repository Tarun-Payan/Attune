"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Layers,
  Play,
  RefreshCw,
  Save,
  ShieldAlert,
  Terminal,
  Trash2,
} from "lucide-react";
import { SOURCE_TYPES, type Source, type SourceType, type SyncRun } from "@attune/types";
import { sourcePatchSchema } from "@attune/schemas";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  Input,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";

const TYPES = SOURCE_TYPES;

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

export default function SourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sourceId = params?.id as string;

  const { can, loading: permsLoading } = usePermissions();

  const [source, setSource] = useState<Source | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<SourceType>("RSS");
  const [feedUrl, setFeedUrl] = useState("");
  const [credibility, setCredibility] = useState(3);
  const [enabled, setEnabled] = useState(true);
  const [rawConfig, setRawConfig] = useState("{}");
  const [configError, setConfigError] = useState<string | null>(null);

  // Modal inspection
  const [selectedRun, setSelectedRun] = useState<SyncRun | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!sourceId || !can("sources", "read")) return;
    setLoading(true);
    try {
      const [sourceRes, runsRes] = await Promise.all([
        api.sources.get(sourceId),
        api.syncRuns.list({ sourceId, limit: 15 }),
      ]);
      const s = sourceRes.source;
      setSource(s);
      setRuns(runsRes.runs);

      // Populate form state
      setName(s.name);
      setType(s.type);
      setCredibility(s.credibility);
      setEnabled(s.enabled);
      const conf = s.config || {};
      const foundUrl = (conf.feedUrl as string) || (conf.url as string) || "";
      setFeedUrl(foundUrl);
      setRawConfig(JSON.stringify(conf, null, 2));
      setConfigError(null);
    } catch (err: unknown) {
      toast.error("Failed to load source", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [sourceId, can]);

  useEffect(() => {
    if (!permsLoading) {
      loadData();
    }
  }, [permsLoading, loadData]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source) return;

    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = rawConfig.trim() ? JSON.parse(rawConfig) : {};
    } catch (err) {
      setConfigError("Invalid JSON configuration");
      return;
    }

    if (feedUrl.trim()) {
      parsedConfig.feedUrl = feedUrl.trim();
    }

    const payload = {
      name: name.trim(),
      config: parsedConfig,
      enabled,
      credibility,
    };

    const parsed = sourcePatchSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      setConfigError(msg);
      return;
    }

    setSaving(true);
    setConfigError(null);
    try {
      const res = await api.sources.patch(source.id, parsed.data);
      setSource(res.source);
      toast.success("Source updated successfully");
    } catch (err: unknown) {
      toast.error("Failed to save changes", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Sync Now
  const handleSyncNow = async () => {
    if (!source) return;
    setSyncing(true);
    try {
      await api.sources.run(source.id);
      toast.success(`Sync scheduled for ${source.name}`);
      setTimeout(() => {
        loadData();
      }, 1500);
    } catch (err: unknown) {
      toast.error("Failed to queue sync", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSyncing(false);
    }
  };

  // Handle Toggle Enabled
  const handleToggleEnabled = async () => {
    if (!source) return;
    try {
      const res = await api.sources.patch(source.id, { enabled: !source.enabled });
      setSource(res.source);
      setEnabled(res.source.enabled);
      toast.success(`Source ${res.source.enabled ? "enabled" : "disabled"}`);
    } catch (err: unknown) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!source) return;
    if (!window.confirm(`Are you sure you want to delete source "${source.name}" and all its items? This action cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await api.sources.delete(source.id);
      toast.success(`Source "${source.name}" deleted`);
      router.push("/sources");
    } catch (err: unknown) {
      toast.error("Failed to delete source", {
        description: err instanceof Error ? err.message : String(err),
      });
      setDeleting(false);
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

  if (!permsLoading && !can("sources", "read")) {
    return <AccessDenied feature="Sources" />;
  }

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Spinner className="h-7 w-7 text-primary" />
        <span className="text-sm text-muted-foreground">Loading source details…</span>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="space-y-4">
        <Link
          href="/sources"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to sources
        </Link>
        <Card className="p-8 text-center text-muted-foreground">
          <AlertCircle className="mx-auto mb-2 text-destructive" size={24} />
          <h3 className="font-semibold text-foreground">Source Not Found</h3>
          <p className="mt-1 text-xs">The requested source ID does not exist or has been removed.</p>
        </Card>
      </div>
    );
  }

  // Calculate Health & Circuit Breaker Telemetry
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.status === "ok").length;
  const failedRuns = runs.filter((r) => r.status === "error").length;
  const successRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 100;
  const totalItemsIngested = runs.reduce((acc, r) => acc + (r.itemsNew || 0), 0);

  // Circuit breaker: 10 consecutive failures
  const consecutiveFailures = (() => {
    let count = 0;
    for (const r of runs) {
      if (r.status === "error") count++;
      else break;
    }
    return count;
  })();

  const isCircuitBroken = consecutiveFailures >= 10 || (!source.enabled && consecutiveFailures >= 5);

  const selectedRunDiagnostic = selectedRun ? getErrorDiagnostic(selectedRun.error) : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <Link
              href="/sources"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Back to sources"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{source.name}</h1>
            <Badge variant={source.enabled ? "success" : "destructive"}>
              {source.enabled ? "Active" : "Disabled"}
            </Badge>
            <code className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              {source.type}
            </code>
          </div>
          <p className="text-xs text-muted-foreground pl-8">
            Source ID: <code className="font-mono text-[11px]">{source.id}</code> • Credibility:{" "}
            <span className="text-amber-500 font-mono">{"★".repeat(source.credibility)}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {can("sources", "write") && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSyncNow}
              disabled={syncing}
              className="gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw size={13} className={cn(syncing && "animate-spin")} />
              <span>{syncing ? "Queueing Sync…" : "Sync Now"}</span>
            </Button>
          )}

          <Link
            href={`/logs?q=${encodeURIComponent(source.name)}&service=worker`}
            className="inline-flex items-center gap-1.5 rounded-4xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
          >
            <Terminal size={13} className="text-primary" />
            <span>Worker Logs</span>
          </Link>

          {can("sources", "update") && (
            <Button
              variant={source.enabled ? "outline" : "secondary"}
              size="sm"
              onClick={handleToggleEnabled}
              className="cursor-pointer"
            >
              {source.enabled ? "Disable Source" : "Enable Source"}
            </Button>
          )}

          {can("sources", "write") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </Button>
          )}
        </div>
      </div>

      {/* Circuit Breaker Alert (if tripped) */}
      {isCircuitBroken && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
          <ShieldAlert size={18} className="shrink-0" />
          <div className="space-y-0.5">
            <span className="font-bold uppercase tracking-wider">Circuit Breaker Active</span>
            <p className="text-foreground/90 font-medium">
              This source has failed {consecutiveFailures} consecutive sync attempts and has been paused to protect system workers from repeatedly polling a dead endpoint. Verify the feed URL below and trigger a manual sync to reset.
            </p>
          </div>
        </div>
      )}

      {/* 4 Health & Telemetry KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Health Status
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                isCircuitBroken
                  ? "bg-rose-500 animate-pulse"
                  : failedRuns > 2
                  ? "bg-amber-500"
                  : "bg-emerald-500",
              )}
            />
            <span className="font-bold text-foreground text-base">
              {isCircuitBroken ? "Tripped" : failedRuns > 2 ? "Degraded" : "Healthy"}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {consecutiveFailures > 0 ? `${consecutiveFailures} consecutive errors` : "Zero recent errors"}
          </div>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Success Rate
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">
            {successRate}%
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {passedRuns} passed / {failedRuns} failed ({totalRuns} runs)
          </div>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Last Sync
          </div>
          <div className="mt-1 text-base font-semibold text-foreground truncate">
            {formatRelativeTime(source.lastSyncAt)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground truncate">
            {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleTimeString() : "Never synced"}
          </div>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Items Ingested
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalItemsIngested}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            From last {runs.length} recorded runs
          </div>
        </Card>
      </div>

      {/* Main Content Grid: Configuration Editor + Recent Sync Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Configuration Form Card (5 cols) */}
        <Card className="p-6 lg:col-span-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Source Configuration</h2>
              <p className="text-xs text-muted-foreground">Edit feed connector parameters and credibility</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {configError && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-600 dark:text-rose-400 font-medium">
                {configError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Source Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. TechCrunch"
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Connector Type</label>
              <Select value={type} onValueChange={(val) => setType(val as SourceType)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs font-mono">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Feed / Endpoint URL</label>
              <div className="flex gap-2">
                <Input
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="font-mono text-xs"
                />
                {feedUrl && (
                  <a
                    href={feedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-3 text-muted-foreground hover:text-foreground transition-colors"
                    title="Open feed URL in new tab"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Credibility Weight (1 to 5)</label>
              <Select
                value={String(credibility)}
                onValueChange={(val) => setCredibility(Number(val))}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <SelectItem key={stars} value={String(stars)} className="text-xs font-mono">
                      {"★".repeat(stars)} ({stars} / 5)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">Advanced JSON Config</label>
                <span className="text-[11px] text-muted-foreground">Headers, selectors, etc.</span>
              </div>
              <Textarea
                value={rawConfig}
                onChange={(e) => setRawConfig(e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sourceEnabled"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-border cursor-pointer"
                />
                <label htmlFor="sourceEnabled" className="text-xs font-semibold text-foreground cursor-pointer">
                  Enabled
                </label>
              </div>

              {can("sources", "update") && (
                <Button type="submit" disabled={saving} className="gap-1.5 cursor-pointer">
                  {saving ? <Spinner className="w-3.5 h-3.5" /> : <Save size={13} />}
                  <span>{saving ? "Saving…" : "Save Changes"}</span>
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Recent Sync Runs Audit Trail (7 cols) */}
        <Card className="lg:col-span-7 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Recent Sync Runs</h2>
              <p className="text-xs text-muted-foreground">Execution audit trail for this specific connector</p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={loadData}
              disabled={loading}
              className="gap-1 cursor-pointer"
            >
              <RefreshCw size={12} className={cn(loading && "animate-spin")} />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <thead className="bg-muted/30">
                <tr>
                  <Th>Status</Th>
                  <Th>Found</Th>
                  <Th>New</Th>
                  <Th>Duration</Th>
                  <Th>Started</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const isError = r.status === "error";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRun(r)}
                      className={cn(
                        "cursor-pointer transition-colors border-b border-border/60 last:border-0",
                        isError
                          ? "hover:bg-rose-500/10 bg-rose-500/5 dark:bg-rose-950/20"
                          : "hover:bg-muted/40",
                      )}
                    >
                      <Td>
                        <Badge variant={isError ? "destructive" : "success"}>
                          {r.status}
                        </Badge>
                      </Td>
                      <Td className="font-mono text-xs text-muted-foreground">{r.itemsFound}</Td>
                      <Td className="font-mono text-xs text-muted-foreground">{r.itemsNew}</Td>
                      <Td className="font-mono text-xs text-muted-foreground">
                        {formatDuration(r.startedAt, r.finishedAt)}
                      </Td>
                      <Td className="text-xs text-muted-foreground whitespace-nowrap">
                        <div>{new Date(r.startedAt).toLocaleTimeString()}</div>
                        <div className="text-[10px] text-muted-foreground/70">
                          {formatRelativeTime(r.startedAt)}
                        </div>
                      </Td>
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRun(r);
                          }}
                          className="h-7 px-2 text-xs gap-1 cursor-pointer text-muted-foreground hover:text-foreground"
                          title="Inspect job run"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
                {runs.length === 0 && (
                  <tr>
                    <Td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No sync runs recorded yet for this source.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Sync Run Details Modal */}
      {selectedRun && selectedRunDiagnostic && (
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
                  <span className="font-bold text-foreground text-base">
                    {source.name}
                  </span>
                  <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                    {source.type}
                  </span>
                </div>
              </div>

              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background border border-border px-2.5 py-1 rounded-lg">
                <Clock size={12} className="text-primary" />
                {formatDuration(selectedRun.startedAt, selectedRun.finishedAt)}
              </span>
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
                        {selectedRunDiagnostic.category}
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
                  {selectedRunDiagnostic.summary}
                </p>

                <div className="rounded-xl border border-border/60 bg-muted/60 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Troubleshooting Advice: </span>
                  {selectedRunDiagnostic.remediation}
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

            {/* Identification & Timestamps */}
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

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              {can("sources", "write") && (
                <Button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} className={cn(syncing && "animate-spin")} />
                  <span>{syncing ? "Scheduling Sync…" : "Retry Sync Now"}</span>
                </Button>
              )}

              <Link
                href={`/logs?q=${encodeURIComponent(source.name)}&service=worker&sourceId=${encodeURIComponent(source.id)}${selectedRun.jobId ? `&jobId=${encodeURIComponent(selectedRun.jobId)}` : ""}`}
                className="inline-flex items-center gap-1.5 rounded-4xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Terminal size={14} className="text-primary" />
                <span>View Related Logs</span>
              </Link>

              <Link
                href={
                  selectedRun.jobId
                    ? `/jobs?tab=bull-board&jobId=${encodeURIComponent(selectedRun.jobId)}`
                    : selectedRun.status === "error"
                    ? `/jobs?tab=bull-board&sub=${encodeURIComponent("/queue/ingest?status=failed")}`
                    : `/jobs?tab=bull-board&sub=${encodeURIComponent("/queue/ingest")}`
                }
                className="inline-flex items-center gap-1.5 rounded-4xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Layers size={14} className="text-primary" />
                <span>
                  {selectedRun.jobId
                    ? "View Job in Bull Board"
                    : selectedRun.status === "error"
                    ? "View in Bull Board (Failed)"
                    : "View in Bull Board"}
                </span>
              </Link>

              <Link
                href="/jobs"
                className="inline-flex items-center gap-1.5 rounded-4xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Layers size={14} className="text-primary" />
                <span>View All Jobs</span>
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
