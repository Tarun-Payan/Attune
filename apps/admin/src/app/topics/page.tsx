"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Plus, Sparkles, Tag as TagIcon, Trash2, X } from "lucide-react";
import type { AdminTopicRow as Topic, Tag } from "@attune/types";
import { tagCreateSchema, topicCreateSchema, topicPatchSchema } from "@attune/schemas";
import { toast } from "sonner";
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
  Td,
  Th,
  useClientPagination,
  useColumnVisibility,
} from "@/components/ui";
import { DynamicIcon, isIconValid, ICON_ALIASES } from "@/components/DynamicIcon";

const TOPIC_COLUMNS: ColumnDef[] = [
  { id: "topic", label: "Topic", defaultVisible: true, required: true },
  { id: "key", label: "Key", defaultVisible: true },
  { id: "tags", label: "Tags", defaultVisible: true },
  { id: "itemTotal", label: "Items (total)", defaultVisible: true },
  { id: "itemWeek", label: "Items (7d)", defaultVisible: true },
  { id: "followers", label: "Followers", defaultVisible: true },
  { id: "actions", label: "Actions", defaultVisible: true },
];

export default function TopicsPage() {
  const { can, loading: permsLoading } = usePermissions();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [managingTagsTopic, setManagingTagsTopic] = useState<Topic | null>(null);

  const load = useCallback(() => {
    if (can("topics", "read")) {
      api.topics
        .list()
        .then((d) => setTopics(d.topics))
        .catch((err) => {
          console.error("Failed to load topics:", err);
        });
    }
  }, [can]);
  useEffect(load, [load]);

  const filteredTopics = useMemo(() => {
    if (!topics) return [];
    const q = search.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) => t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q),
    );
  }, [topics, search]);

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    paginatedItems: pageTopics,
  } = useClientPagination(filteredTopics, 10);

  const { isVisible, toggleColumn, resetColumns, visibleCount } = useColumnVisibility(
    "topics",
    TOPIC_COLUMNS,
  );

  const remove = async (t: Topic) => {
    if (!window.confirm(`Delete topic "${t.name}"? Its items stay but lose this tag.`)) return;
    try {
      await api.topics.delete(t.id);
      toast.success(`Deleted topic "${t.name}"`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete topic");
    }
  };

  if (!permsLoading && !can("topics", "read")) {
    return <AccessDenied feature="Topics & Tags" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Topics & Tags"
        subtitle="The macro domains and micro tags users and items belong to"
        action={
          can("topics", "create") ? (
            <Button
              onClick={() => {
                setEditingTopic(null);
                setModalOpen(true);
              }}
            >
              <Plus size={15} className="mr-2" /> New topic
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search topics by name or key…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-md flex-1"
        />
        <ColumnVisibilityDropdown
          columns={TOPIC_COLUMNS}
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
                {isVisible("topic") && <Th>Topic</Th>}
                {isVisible("key") && <Th>Key</Th>}
                {isVisible("tags") && <Th>Tags</Th>}
                {isVisible("itemTotal") && <Th>Items (total)</Th>}
                {isVisible("itemWeek") && <Th>Items (7d)</Th>}
                {isVisible("followers") && <Th>Followers</Th>}
                {isVisible("actions") && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {pageTopics.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
                  {isVisible("topic") && (
                    <Td className="font-semibold text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-primary shadow-xs">
                          <DynamicIcon name={t.icon} size={18} fallback={<Hash size={16} className="text-muted-foreground" />} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{t.name}</div>
                          {t.icon ? <div className="text-[11px] font-mono text-muted-foreground">{t.icon}</div> : null}
                        </div>
                      </div>
                    </Td>
                  )}
                  {isVisible("key") && (
                    <Td>
                      <code className="rounded-lg bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">{t.key}</code>
                    </Td>
                  )}
                  {isVisible("tags") && (
                    <Td>
                      <button
                        onClick={() => setManagingTagsTopic(t)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/40 transition-colors"
                      >
                        <TagIcon size={12} className="text-primary" />
                        {t.tagCount ?? 0} tags
                      </button>
                    </Td>
                  )}
                  {isVisible("itemTotal") && (
                    <Td className="text-muted-foreground font-mono text-xs">{t.itemTotal}</Td>
                  )}
                  {isVisible("itemWeek") && (
                    <Td className="text-muted-foreground font-mono text-xs">{t.itemWeek}</Td>
                  )}
                  {isVisible("followers") && (
                    <Td className="text-muted-foreground font-mono text-xs">{t.followers}</Td>
                  )}
                  {isVisible("actions") && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setManagingTagsTopic(t)} title="Manage Tags">
                          Tags
                        </Button>
                        {can("topics", "update") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingTopic(t);
                              setModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        {can("topics", "write") && (
                          <Button variant="destructive" size="sm" onClick={() => remove(t)} title="Delete">
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
              {pageTopics.length === 0 ? (
                <tr>
                  <Td colSpan={visibleCount} className="py-8 text-center text-muted-foreground">No topics found.</Td>
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

      <TopicModal
        topic={editingTopic}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTopic(null);
        }}
        onSaved={() => {
          setModalOpen(false);
          setEditingTopic(null);
          load();
        }}
        onTagsUpdated={load}
      />

      {managingTagsTopic && (
        <TopicTagsModal
          topic={managingTagsTopic}
          onClose={() => setManagingTagsTopic(null)}
          onTagsUpdated={load}
        />
      )}
    </div>
  );
}

const RECOMMENDED_ICONS = [
  "BrainCircuit",
  "Code",
  "Smartphone",
  "CloudCog",
  "ShieldCheck",
  "Rocket",
  "Orbit",
  "Telescope",
  "Cpu",
  "FlaskConical",
  "Gamepad2",
  "Bitcoin",
  "Coins",
  "GitFork",
  "Palette",
  "Sparkles",
];

function TopicModal({
  topic,
  isOpen,
  onClose,
  onSaved,
  onTagsUpdated,
}: {
  topic: Topic | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  onTagsUpdated?: () => void;
}) {
  const { can } = usePermissions();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Associated Tags state for Edit mode
  const [topicTags, setTopicTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [newTagKey, setNewTagKey] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [addingTag, setAddingTag] = useState(false);

  const fetchTopicTags = useCallback(async () => {
    if (!topic) return;
    setTagsLoading(true);
    try {
      const res = await api.tags.list(topic.id);
      setTopicTags(res.tags);
    } catch (err) {
      console.error("Failed to load topic tags:", err);
    } finally {
      setTagsLoading(false);
    }
  }, [topic]);

  useEffect(() => {
    if (isOpen) {
      setKey(topic?.key ?? "");
      setName(topic?.name ?? "");
      setIcon(topic?.icon ?? "");
      setError(null);
      setSaving(false);
      setNewTagKey("");
      setNewTagName("");
      setTagError(null);
      if (topic) {
        fetchTopicTags();
      } else {
        setTopicTags([]);
      }
    }
  }, [isOpen, topic, fetchTopicTags]);

  const handleAddTagInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    setTagError(null);
    const k = newTagKey.trim().toLowerCase().replace(/\s+/g, "-");
    const n = newTagName.trim();
    if (!k || !n) return;

    const validated = tagCreateSchema.safeParse({ key: k, name: n, topicId: topic.id });
    if (!validated.success) {
      setTagError(validated.error.errors[0]?.message ?? "Invalid tag data");
      return;
    }

    setAddingTag(true);
    try {
      await api.tags.create(validated.data);
      setNewTagKey("");
      setNewTagName("");
      toast.success(`Tag "${n}" added to ${topic.name}`);
      await fetchTopicTags();
      onTagsUpdated?.();
    } catch (err) {
      setTagError(err instanceof Error ? err.message : "Failed to add tag");
    } finally {
      setAddingTag(false);
    }
  };

  const handleDeleteTagInline = async (tagId: string, tagName: string) => {
    if (!window.confirm(`Delete tag "${tagName}"?`)) return;
    try {
      await api.tags.delete(tagId);
      toast.success(`Deleted tag "${tagName}"`);
      await fetchTopicTags();
      onTagsUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tag");
    }
  };

  const save = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (topic) {
        const validated = topicPatchSchema.safeParse({ name, ...(icon ? { icon } : {}) });
        if (!validated.success) {
          setError(validated.error.errors[0]?.message ?? "Invalid topic data");
          setSaving(false);
          return;
        }
        await api.topics.patch(topic.id, validated.data);
        toast.success(`Topic "${name}" updated successfully`);
      } else {
        const validated = topicCreateSchema.safeParse({ key, name, ...(icon ? { icon } : {}) });
        if (!validated.success) {
          setError(validated.error.errors[0]?.message ?? "Invalid topic data");
          setSaving(false);
          return;
        }
        await api.topics.create(validated.data);
        toast.success(`Topic "${name}" created successfully`);
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
      title={topic ? `Edit Topic — ${topic.name}` : "New Topic"}
    >
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Key {topic ? "(immutable)" : ""}
            </label>
            <Input
              value={key}
              disabled={Boolean(topic)}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="e.g. fintech"
              required={!topic}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!topic && (!key || key === name.toLowerCase().replace(/\s+/g, "-").slice(0, -1))) {
                  setKey(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }
              }}
              placeholder="e.g. Fintech"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Icon (Lucide name or emoji)
          </label>
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-primary shadow-xs"
              title="Live Icon Preview"
            >
              <DynamicIcon
                name={icon}
                size={22}
                fallback={<Hash size={18} className="text-muted-foreground" />}
              />
            </div>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. Bitcoin, Orbit, Rocket, BrainCircuit"
              maxLength={60}
              className="flex-1"
            />
          </div>
        </div>

        <div className="border-t border-border/60 pt-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Quick select icon:</span>
            {icon.trim() && (
              <span className="text-xs">
                {isIconValid(icon) ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {ICON_ALIASES[icon.toLowerCase()]
                      ? `✓ Mapped "${icon}" → Lucide "${ICON_ALIASES[icon.toLowerCase()]}"`
                      : "✓ Valid Lucide icon"}
                  </span>
                ) : (
                  <span className="text-destructive font-medium">
                    "{icon}" is not in Lucide. For space, try Orbit or Rocket.
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {RECOMMENDED_ICONS.map((icName) => {
              const isSelected = icon.toLowerCase() === icName.toLowerCase();
              return (
                <button
                  key={icName}
                  type="button"
                  onClick={() => setIcon(icName)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                      : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <DynamicIcon name={icName} size={13} />
                  <span>{icName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {topic && (
          <div className="border-t border-border/60 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TagIcon size={13} className="text-primary" />
                <span>Associated Tags ({topicTags.length})</span>
              </label>
              {tagsLoading && <span className="text-xs text-muted-foreground">Loading tags...</span>}
            </div>

            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
              {topicTags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground"
                >
                  <TagIcon size={11} className="text-primary" />
                  <span className="font-medium">{t.name}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">({t.key})</span>
                  {can("topics", "write") && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTagInline(t.id, t.name)}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title="Remove tag"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              {!tagsLoading && topicTags.length === 0 && (
                <p className="text-xs text-muted-foreground">No tags assigned to this topic yet.</p>
              )}
            </div>

            {can("topics", "create") && (
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 space-y-2.5">
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Plus size={13} className="text-primary" />
                  <span>Add Tag to {topic.name}</span>
                </div>
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="flex-1 min-w-35">
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Tag Name</label>
                    <Input
                      value={newTagName}
                      onChange={(e) => {
                        setNewTagName(e.target.value);
                        if (!newTagKey || newTagKey === newTagName.toLowerCase().replace(/\s+/g, "-").slice(0, -1)) {
                          setNewTagKey(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                        }
                      }}
                      placeholder="e.g. Next.js"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex-1 min-w-35">
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Tag Key (slug)</label>
                    <Input
                      value={newTagKey}
                      onChange={(e) => setNewTagKey(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                      placeholder="e.g. nextjs"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddTagInline}
                    disabled={addingTag || !newTagKey.trim() || !newTagName.trim()}
                    className="h-8 text-xs cursor-pointer gap-1"
                  >
                    <Plus size={13} />
                    <span>{addingTag ? "Adding..." : "Add Tag"}</span>
                  </Button>
                </div>
                {tagError && <p className="text-xs text-destructive">{tagError}</p>}
              </div>
            )}
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim() || (!topic && !key.trim())}>
            {saving ? "Saving..." : topic ? "Update Topic" : "Create Topic"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TopicTagsModal({
  topic,
  onClose,
  onTagsUpdated,
}: {
  topic: Topic;
  onClose: () => void;
  onTagsUpdated: () => void;
}) {
  const { can } = usePermissions();
  const [tags, setTags] = useState<Tag[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.tags.list(topic.id);
      setTags(res.tags);
    } catch {
      // ignore
    }
  }, [topic.id]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "-");
    const name = newName.trim();
    if (!key || !name) return;

    const validated = tagCreateSchema.safeParse({ key, name, topicId: topic.id });
    if (!validated.success) {
      setError(validated.error.errors[0]?.message ?? "Invalid tag data");
      return;
    }

    setLoading(true);
    try {
      await api.tags.create(validated.data);
      setNewKey("");
      setNewName("");
      await fetchTags();
      onTagsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!window.confirm(`Delete tag "${tagName}"?`)) return;
    try {
      await api.tags.delete(tagId);
      await fetchTags();
      onTagsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag");
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Tags for ${topic.name}`}>
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Existing Tags ({tags.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground"
              >
                <TagIcon size={12} className="text-primary" />
                <span className="font-medium">{tag.name}</span>
                <span className="text-muted-foreground font-mono text-[11px]">({tag.key})</span>
                {can("topics", "write") && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag.id, tag.name)}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    title="Delete tag"
                  >
                    <X size={13} />
                  </button>
                )}
              </span>
            ))}
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground">No tags assigned to this topic yet.</p>
            )}
          </div>
        </div>

        {can("topics", "create") && (
          <div className="border-t border-border/60 pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Add New Tag
            </h3>
            <form onSubmit={handleAddTag} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-35">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tag Name</label>
                <Input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newKey || newKey === newName.toLowerCase().replace(/\s+/g, "-").slice(0, -1)) {
                      setNewKey(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }
                  }}
                  placeholder="e.g. Next.js"
                  required
                />
              </div>
              <div className="flex-1 min-w-35">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tag Key</label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toLowerCase())}
                  placeholder="e.g. nextjs"
                  required
                />
              </div>
              <Button type="submit" disabled={loading || !newKey.trim() || !newName.trim()}>
                <Plus size={15} className="mr-1 inline" />
                {loading ? "Adding..." : "Add Tag"}
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
