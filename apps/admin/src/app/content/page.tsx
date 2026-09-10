"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminItemRow as Item, SourceOption, TopicOption } from "@attune/types";
import { api } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  ColumnDef,
  ColumnVisibilityDropdown,
  Input,
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

const CONTENT_COLUMNS: ColumnDef[] = [
  { id: "item", label: "Item", defaultVisible: true, required: true },
  { id: "source", label: "Source", defaultVisible: true },
  { id: "topics", label: "Topics & Tags", defaultVisible: true },
  { id: "published", label: "Published", defaultVisible: true },
  { id: "moderation", label: "Moderation", defaultVisible: true },
];

export default function ContentPage() {
  const { can, loading: permsLoading } = usePermissions();
  const [items, setItems] = useState<Item[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [hidden, setHidden] = useState("false");
  const [reported, setReported] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const { isVisible, toggleColumn, resetColumns, visibleCount } = useColumnVisibility(
    "content",
    CONTENT_COLUMNS,
  );

  useEffect(() => {
    if (can("content", "read")) {
      api.topics
        .list()
        .then((d) => setTopics(d.topics))
        .catch((err) => console.error("Failed to load topics:", err));
      api.sources
        .list()
        .then((d) => setSources(d.sources))
        .catch((err) => console.error("Failed to load sources:", err));
    }
  }, [can]);

  const load = useCallback(() => {
    if (!can("content", "read")) return;
    setLoading(true);
    api.items
      .list({
        q: q.trim() || undefined,
        topic: topic || undefined,
        sourceId: sourceId || undefined,
        hidden: (hidden as "true" | "false") || undefined,
        reported: (reported as "true" | "false") || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      .then((d) => {
        setItems(d.items);
        setTotalCount(d.count);
      })
      .catch((err) => console.error("Failed to load items:", err))
      .finally(() => setLoading(false));
  }, [can, q, topic, sourceId, hidden, reported, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterChange = (setter: (v: string) => void, val: string) => {
    setter(val);
    setPage(1);
  };

  const setHiddenFlag = async (item: Item, value: boolean) => {
    await api.items.patch(item.id, { hidden: value });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, hidden: value } : i)));
  };

  const dismissReports = async (item: Item) => {
    await api.items.dismissReports(item.id);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, reportsCount: 0, hidden: false } : i)),
    );
  };

  if (!permsLoading && !can("content", "read")) {
    return <AccessDenied feature="Content" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Content" subtitle="Moderation queue — hide items, inspect tagging" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <Input
            placeholder="Search title or URL…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="min-w-55 flex-1"
          />
          <Select
            value={topic || "all"}
            onValueChange={(val) => handleFilterChange(setTopic, val === "all" ? "" : val)}
          >
            <SelectTrigger className="w-38">
              <SelectValue placeholder="All topics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sourceId || "all"}
            onValueChange={(val) => handleFilterChange(setSourceId, val === "all" ? "" : val)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={hidden || "all"}
            onValueChange={(val) => handleFilterChange(setHidden, val === "all" ? "" : val)}
          >
            <SelectTrigger className="w-34">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All visibility</SelectItem>
              <SelectItem value="false">Visible</SelectItem>
              <SelectItem value="true">Hidden</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={reported || "all"}
            onValueChange={(val) => handleFilterChange(setReported, val === "all" ? "" : val)}
          >
            <SelectTrigger className="w-38">
              <SelectValue placeholder="All Reports" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="true">Reported Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => load()}>
            Apply
          </Button>
          <ColumnVisibilityDropdown
            columns={CONTENT_COLUMNS}
            isVisible={isVisible}
            onToggle={toggleColumn}
            onReset={resetColumns}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-175">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {isVisible("item") && <Th>Item</Th>}
                {isVisible("source") && <Th>Source</Th>}
                {isVisible("topics") && <Th>Topics & Tags</Th>}
                {isVisible("published") && <Th>Published</Th>}
                {isVisible("moderation") && <Th className="text-right">Moderation</Th>}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {isVisible("item") && (
                    <Td className="max-w-95">
                      <div className="flex items-center gap-2">
                        <a
                          href={i.url}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-2 font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {i.title}
                        </a>
                        {i.reportsCount > 0 ? (
                          <Badge variant="destructive">🚩 {i.reportsCount}</Badge>
                        ) : null}
                      </div>
                    </Td>
                  )}
                  {isVisible("source") && (
                    <Td className="text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">{i.sourceName}</div>
                      {i.author && !i.sourceName.toLowerCase().includes(i.author.toLowerCase()) ? (
                        <div className="text-[11px] text-primary">by {i.author}</div>
                      ) : null}
                      {i.metrics?.views || i.metrics?.likes || i.metrics?.stars ? (
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          {i.metrics?.views ? (
                            <span>▶ {formatMetric(i.metrics.views)} views</span>
                          ) : null}
                          {i.metrics?.likes ? (
                            <span>👍 {formatMetric(i.metrics.likes)} likes</span>
                          ) : null}
                          {i.metrics?.stars ? (
                            <span>★ {formatMetric(i.metrics.stars)} stars</span>
                          ) : null}
                        </div>
                      ) : null}
                    </Td>
                  )}
                  {isVisible("topics") && (
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {i.topics.slice(0, 3).map((t) => (
                          <Badge key={t} variant="info">
                            {t}
                          </Badge>
                        ))}
                        {i.tags?.slice(0, 3).map((tg) => (
                          <Badge key={tg} variant="outline">
                            #{tg}
                          </Badge>
                        ))}
                        {i.topics.length === 0 && (!i.tags || i.tags.length === 0) ? (
                          <Badge variant="secondary">untagged</Badge>
                        ) : null}
                      </div>
                    </Td>
                  )}
                  {isVisible("published") && (
                    <Td className="text-xs text-muted-foreground">
                      {new Date(i.publishedAt).toLocaleDateString()}
                    </Td>
                  )}
                  {isVisible("moderation") && (
                    <Td className="text-right space-x-2">
                      {can("content", "write") && i.reportsCount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => dismissReports(i)}
                          className="mr-2 text-xs"
                        >
                          Dismiss reports
                        </Button>
                      )}
                      {can("content", "update") && (
                        i.hidden ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHiddenFlag(i, false)}
                          >
                            Unhide
                          </Button>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setHiddenFlag(i, true)}
                          >
                            Hide
                          </Button>
                        )
                      )}
                      {!can("content", "update") && !can("content", "write") && (
                        <span className="text-xs text-muted-foreground italic">View only</span>
                      )}
                    </Td>
                  )}
                </tr>
              ))}
              {items.length === 0 && !loading ? (
                <tr>
                  <Td colSpan={visibleCount} className="py-8 text-center text-muted-foreground">
                    No items match the filters.
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
            disabled={loading}
          />
        </div>
      </Card>
    </div>
  );
}

function formatMetric(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
