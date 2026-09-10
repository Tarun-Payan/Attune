"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Layers, ListFilter } from "lucide-react";
import type { SyncRun } from "@attune/types";
import { api, bullBoardUrl } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  ColumnDef,
  ColumnVisibilityDropdown,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Td,
  Th,
  useColumnVisibility,
} from "@/components/ui";

const SYNC_RUN_COLUMNS: ColumnDef[] = [
  { id: "source", label: "Source", defaultVisible: true, required: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "found", label: "Found", defaultVisible: true },
  { id: "new", label: "New", defaultVisible: true },
  { id: "detail", label: "Detail", defaultVisible: true },
  { id: "started", label: "Started", defaultVisible: true },
];

export default function JobsPage() {
  const { can, loading: permsLoading } = usePermissions();
  const [tab, setTab] = useState<"sync-runs" | "bull-board">("sync-runs");
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [boardUrl, setBoardUrl] = useState<string | null>(null);

  const [boardLoading, setBoardLoading] = useState(false);

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

  const loadBullBoard = useCallback(async () => {
    setBoardLoading(true);
    try {
      const url = await bullBoardUrl();
      setBoardUrl(url);
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "bull-board") {
      loadBullBoard();
    }
  }, [tab, loadBullBoard]);

  if (!permsLoading && !can("jobs", "read")) {
    return <AccessDenied feature="Jobs & Queues" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="Sync audit trail and BullMQ live queue telemetry"
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
            <Button variant="outline" onClick={load} disabled={loading}>
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadBullBoard}
              disabled={boardLoading}
              className="cursor-pointer"
            >
              {boardLoading ? "Refreshing..." : "Refresh Board"}
            </Button>
            {boardUrl && (
              <a
                href={boardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs cursor-pointer"
              >
                <ExternalLink size={13} className="text-primary" />
                <span>Open in new window</span>
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
                  {isVisible("detail") && <Th>Detail</Th>}
                  {isVisible("started") && <Th>Started</Th>}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
                    {isVisible("source") && (
                      <Td>
                        <span className="font-medium text-foreground">{r.sourceName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.sourceType}</span>
                      </Td>
                    )}
                    {isVisible("status") && (
                      <Td>
                        <Badge variant={r.status === "ok" ? "success" : "destructive"}>{r.status}</Badge>
                      </Td>
                    )}
                    {isVisible("found") && (
                      <Td className="font-mono text-xs text-muted-foreground">{r.itemsFound}</Td>
                    )}
                    {isVisible("new") && (
                      <Td className="font-mono text-xs text-muted-foreground">{r.itemsNew}</Td>
                    )}
                    {isVisible("detail") && (
                      <Td className="max-w-65 truncate text-xs text-muted-foreground">{r.error ?? "—"}</Td>
                    )}
                    {isVisible("started") && (
                      <Td className="text-xs text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</Td>
                    )}
                  </tr>
                ))}
                {runs.length === 0 ? (
                  <tr>
                    <Td colSpan={visibleCount} className="py-8 text-center text-muted-foreground">No runs recorded.</Td>
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
    </div>
  );
}
