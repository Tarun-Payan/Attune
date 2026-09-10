"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import { SOURCE_TYPES, type Source } from "@attune/types";
import { sourceCreateSchema, sourcePatchSchema } from "@attune/schemas";
import { api } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  ColumnDef,
  ColumnVisibilityDropdown,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Td,
  Textarea,
  Th,
  useClientPagination,
  useColumnVisibility,
} from "@/components/ui";

const TYPES = SOURCE_TYPES;

const SOURCE_COLUMNS: ColumnDef[] = [
  { id: "status", label: "Status", defaultVisible: true },
  { id: "name", label: "Name", defaultVisible: true, required: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "credibility", label: "Credibility", defaultVisible: true },
  { id: "lastSync", label: "Last sync", defaultVisible: true },
  { id: "actions", label: "Actions", defaultVisible: true },
];

export default function SourcesPage() {
  const { can, loading: permsLoading } = usePermissions();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (can("sources", "read")) {
      setError(null);
      api.sources
        .list()
        .then((d) => setSources(d.sources))
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load sources");
        });
    }
  }, [can]);
  useEffect(load, [load]);

  const filteredSources = useMemo(() => {
    if (!sources) return [];
    const q = search.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter(
      (s) => s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q),
    );
  }, [sources, search]);

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    paginatedItems: pageSources,
  } = useClientPagination(filteredSources, 10);

  const { isVisible, toggleColumn, resetColumns, visibleCount } = useColumnVisibility(
    "sources",
    SOURCE_COLUMNS,
  );

  const openAddModal = () => {
    setEditingSource(null);
    setIsModalOpen(true);
  };

  const openEditModal = (s: Source) => {
    setEditingSource(s);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSource(null);
  };

  const runNow = async (id: string) => {
    setFlash("Queueing sync…");
    try {
      await api.sources.run(id);
      setFlash("Sync queued successfully!");
      setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Failed to queue sync");
    }
  };

  const toggleEnabled = async (s: Source) => {
    await api.sources.patch(s.id, { enabled: !s.enabled });
    load();
  };

  const remove = async (s: Source) => {
    if (!window.confirm(`Delete "${s.name}" and all its items?`)) return;
    await api.sources.delete(s.id);
    setFlash(`Deleted ${s.name}`);
    load();
  };

  if (!permsLoading && !can("sources", "read")) {
    return <AccessDenied feature="Sources" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sources"
        subtitle="Connectors the worker polls on cron schedules"
        action={
          can("sources", "create") ? (
            <Button onClick={openAddModal}>
              <span className="flex items-center gap-2 cursor-pointer">
                <Plus size={15} /> Add source
              </span>
            </Button>
          ) : undefined
        }
      />
      {flash ? (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {flash}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search sources by name or type…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-md flex-1"
        />
        <ColumnVisibilityDropdown
          columns={SOURCE_COLUMNS}
          isVisible={isVisible}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-175">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {isVisible("status") && <Th>Status</Th>}
                {isVisible("name") && <Th>Name</Th>}
                {isVisible("type") && <Th>Type</Th>}
                {isVisible("credibility") && <Th>Credibility</Th>}
                {isVisible("lastSync") && <Th>Last sync</Th>}
                {isVisible("actions") && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {pageSources.map((s) => {
                const recent = s.lastSyncAt ? Date.now() - new Date(s.lastSyncAt).getTime() < 30 * 60_000 : false;
                return (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
                    {isVisible("status") && (
                      <Td>
                        {s.enabled ? (
                          <Badge variant={recent ? "success" : "warning"}>{recent ? "active" : "idle"}</Badge>
                        ) : (
                          <Badge variant="secondary">disabled</Badge>
                        )}
                      </Td>
                    )}
                    {isVisible("name") && (
                      <Td className="max-w-65 truncate font-semibold text-foreground">{s.name}</Td>
                    )}
                    {isVisible("type") && (
                      <Td>
                        <code className="rounded-lg bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">{s.type}</code>
                      </Td>
                    )}
                    {isVisible("credibility") && (
                      <Td className="text-amber-500">{"★".repeat(s.credibility)}</Td>
                    )}
                    {isVisible("lastSync") && (
                      <Td className="text-xs text-muted-foreground">
                        {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : "never"}
                      </Td>
                    )}
                    {isVisible("actions") && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          {can("sources", "write") && (
                            <Button variant="outline" size="sm" onClick={() => runNow(s.id)} title="Run now">
                              <Play size={14} className="mr-1 inline" /> Sync
                            </Button>
                          )}
                          {can("sources", "update") && (
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(s)} title="Edit">
                              Edit
                            </Button>
                          )}
                          {can("sources", "update") && (
                            <Button
                              variant={s.enabled ? "destructive" : "outline"}
                              size="sm"
                              onClick={() => toggleEnabled(s)}
                              title={s.enabled ? "Disable" : "Enable"}
                            >
                              {s.enabled ? "Disable" : "Enable"}
                            </Button>
                          )}
                          {can("sources", "write") && (
                            <Button variant="destructive" size="sm" onClick={() => remove(s)} title="Delete">
                              <Trash2 size={14} />
                            </Button>
                          )}
                          {!can("sources", "update") && !can("sources", "write") && (
                            <span className="text-xs text-muted-foreground italic py-1">View only</span>
                          )}
                        </div>
                      </Td>
                    )}
                  </tr>
                );
              })}
              {pageSources.length === 0 ? (
                <tr>
                  <Td colSpan={visibleCount} className="py-8 text-center text-muted-foreground">No sources found.</Td>
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
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      </Card>

      <SourceModal
        isOpen={isModalOpen}
        source={editingSource}
        onClose={closeModal}
        onSaved={() => {
          closeModal();
          load();
        }}
      />
    </div>
  );
}

function SourceModal({
  source,
  isOpen,
  onClose,
  onSaved,
}: {
  source: Source | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("RSS");
  const [credibility, setCredibility] = useState(3);
  const [config, setConfig] = useState('{\n  "url": ""\n}');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(source?.name ?? "");
      setType(source?.type ?? "RSS");
      setCredibility(source?.credibility ?? 3);
      setConfig(JSON.stringify(source?.config ?? { url: "" }, null, 2));
      setError(null);
      setSaving(false);
    }
  }, [isOpen, source]);

  const save = async () => {
    setSaving(true);
    setError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config);
    } catch {
      setError("Config is not valid JSON");
      setSaving(false);
      return;
    }
    try {
      if (source) {
        const validated = sourcePatchSchema.safeParse({ name, credibility, config: parsed });
        if (!validated.success) {
          setError(validated.error.errors[0]?.message ?? "Invalid source configuration");
          setSaving(false);
          return;
        }
        await api.sources.patch(source.id, validated.data);
      } else {
        const validated = sourceCreateSchema.safeParse({ name, type, credibility, config: parsed });
        if (!validated.success) {
          setError(validated.error.errors[0]?.message ?? "Invalid source configuration");
          setSaving(false);
          return;
        }
        await api.sources.create(validated.data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={source ? `Edit Source — ${source.name}` : "New Source"}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">NAME</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TechCrunch RSS"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">TYPE</label>
            <Select
              value={type}
              onValueChange={(val) => setType(val)}
              disabled={Boolean(source)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">CREDIBILITY (1–5)</label>
            <Select
              value={String(credibility)}
              onValueChange={(val) => setCredibility(Number(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select credibility" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((c) => (
                  <SelectItem key={c} value={String(c)}>
                    {c} {c === 1 ? "★" : "★".repeat(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            CONFIG (JSON — e.g. {"{"}&quot;url&quot;: &quot;https://…&quot;{"}"})
          </label>
          <Textarea
            rows={5}
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            className="w-full font-mono text-xs"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : source ? "Save Changes" : "Create Source"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
