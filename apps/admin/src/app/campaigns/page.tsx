"use client";

import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Globe,
  Hash,
  Search,
  Send,
  Smartphone,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { CampaignLog as CampaignSend, TopicOption, UserRow } from "@attune/types";
import { campaignSchema } from "@attune/schemas";
import { api } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
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
  Spinner,
  Td,
  Textarea,
  Th,
  useColumnVisibility,
} from "@/components/ui";

const CAMPAIGN_COLUMNS: ColumnDef[] = [
  { id: "recipient", label: "Recipient", defaultVisible: true, required: true },
  { id: "channel", label: "Channel", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "at", label: "Sent At", defaultVisible: true },
  { id: "detail", label: "Detail", defaultVisible: false },
];

interface TargetUser {
  id: string;
  name: string | null;
  email: string;
  deviceCount?: number;
}

function CampaignsContent() {
  const { can, loading: permsLoading } = usePermissions();
  const searchParams = useSearchParams();

  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [sends, setSends] = useState<CampaignSend[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"push" | "email">("push");
  const [targetMode, setTargetMode] = useState<"all" | "topic" | "users">("all");
  const [topicKey, setTopicKey] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<TargetUser[]>([]);

  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserRow[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);

  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const { isVisible, toggleColumn, resetColumns, visibleCount } = useColumnVisibility(
    "campaigns",
    CAMPAIGN_COLUMNS,
  );

  // Pre-populate target user from URL query params (e.g. navigated from Users table)
  useEffect(() => {
    const paramUserId = searchParams.get("userId");
    const paramName = searchParams.get("name");
    const paramEmail = searchParams.get("email");

    if (paramUserId) {
      setTargetMode("users");
      setSelectedUsers((prev) => {
        if (prev.some((u) => u.id === paramUserId)) return prev;
        return [
          ...prev,
          {
            id: paramUserId,
            name: paramName ? decodeURIComponent(paramName) : null,
            email: paramEmail ? decodeURIComponent(paramEmail) : "Target User",
          },
        ];
      });
    }
  }, [searchParams]);

  // Click outside to close user search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for users
  useEffect(() => {
    if (targetMode !== "users") return;
    const trimmed = userSearchQuery.trim();
    if (!trimmed) {
      setUserSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    const timer = setTimeout(() => {
      api.users
        .list({ q: trimmed, limit: 8 })
        .then((res) => {
          setUserSearchResults(res.users || []);
          setShowUserDropdown(true);
        })
        .catch((err) => {
          console.error("Failed to search users:", err);
        })
        .finally(() => {
          setSearchingUsers(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [userSearchQuery, targetMode]);

  const toggleUserSelection = (u: UserRow) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((existing) => existing.id === u.id);
      if (exists) {
        return prev.filter((existing) => existing.id !== u.id);
      }
      return [
        ...prev,
        {
          id: u.id,
          name: u.name,
          email: u.email,
          deviceCount: u.deviceCount,
        },
      ];
    });
  };

  const removeSelectedUser = (id: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const clearAllSelectedUsers = () => {
    setSelectedUsers([]);
  };

  const toggleRowExpanded = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = useCallback(() => {
    if (!can("campaigns", "read")) return;
    setLoading(true);
    api.topics
      .list()
      .then((d) => setTopics(d.topics))
      .catch((err) => console.error("Failed to load topics:", err));
    api.campaigns
      .list({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      .then((d) => {
        setSends(d.sends);
        setTotalCount(d.count);
      })
      .catch((err) => console.error("Failed to load campaigns:", err))
      .finally(() => setLoading(false));
  }, [can, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      if (targetMode === "users" && selectedUsers.length === 0) {
        setResult("Please select at least one recipient user.");
        setSending(false);
        return;
      }
      if (targetMode === "topic" && !topicKey) {
        setResult("Please select a topic.");
        setSending(false);
        return;
      }

      const payload: {
        title: string;
        body: string;
        channel: "push" | "email";
        topicKey?: string;
        userIds?: string[];
      } = {
        title,
        body,
        channel,
      };

      if (targetMode === "topic") {
        payload.topicKey = topicKey;
      } else if (targetMode === "users") {
        payload.userIds = selectedUsers.map((u) => u.id);
      }

      const validated = campaignSchema.safeParse(payload);
      if (!validated.success) {
        setResult(validated.error.errors[0]?.message ?? "Invalid campaign data");
        setSending(false);
        return;
      }
      await api.campaigns.send(validated.data);
      setResult(
        targetMode === "users"
          ? `Campaign queued for ${selectedUsers.length} user${selectedUsers.length > 1 ? "s" : ""} — delivery stats appear below.`
          : "Campaign queued — delivery stats appear in the history table.",
      );
      setTitle("");
      setBody("");
      setTimeout(load, 6000);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (!permsLoading && !can("campaigns", "read")) {
    return <AccessDenied feature="Campaigns" />;
  }

  const isSendDisabled =
    !can("campaigns", "create") ||
    sending ||
    !title.trim() ||
    !body.trim() ||
    (targetMode === "topic" && !topicKey) ||
    (targetMode === "users" && selectedUsers.length === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle="Announcements to everyone, a topic's followers, or specific users"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">New Campaign</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Channel
                </label>
                <Select
                  value={channel}
                  onValueChange={(val) => setChannel(val as "push" | "email")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="push">Push notification</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Audience Segment Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Target Audience
                </label>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 border border-border/50 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setTargetMode("all")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all text-xs font-medium cursor-pointer",
                      targetMode === "all"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Globe size={13} />
                    <span>Everyone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMode("topic")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all text-xs font-medium cursor-pointer",
                      targetMode === "topic"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Hash size={13} />
                    <span>By Topic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMode("users")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all text-xs font-medium cursor-pointer",
                      targetMode === "users"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Users size={13} />
                    <span>Users {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ""}</span>
                  </button>
                </div>

                {targetMode === "all" && (
                  <div className="rounded-xl bg-muted/30 border border-border/60 p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Globe size={14} className="text-primary shrink-0" />
                    <span>Broadcasts to all active users with registered devices or email.</span>
                  </div>
                )}

                {targetMode === "topic" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Select Topic
                    </label>
                    <Select
                      value={topicKey}
                      onValueChange={(val) => setTopicKey(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a topic..." />
                      </SelectTrigger>
                      <SelectContent>
                        {topics.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            Followers of {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {targetMode === "users" && (
                  <div className="space-y-2.5" ref={userSearchRef}>
                    <div className="relative">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Select Recipients
                      </label>
                      <div className="relative">
                        <Input
                          placeholder="Search users by name or email…"
                          value={userSearchQuery}
                          onChange={(e) => {
                            setUserSearchQuery(e.target.value);
                            setShowUserDropdown(true);
                          }}
                          onFocus={() => {
                            if (userSearchResults.length > 0 || userSearchQuery.trim()) {
                              setShowUserDropdown(true);
                            }
                          }}
                          className="pl-9 pr-8"
                        />
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                        />
                        {searchingUsers && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Spinner className="size-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Search Results Dropdown */}
                      {showUserDropdown && userSearchQuery.trim().length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg max-h-56 overflow-y-auto p-1 text-sm">
                          {userSearchResults.length === 0 && !searchingUsers ? (
                            <div className="p-3 text-center text-xs text-muted-foreground">
                              No users found matching &quot;{userSearchQuery.trim()}&quot;
                            </div>
                          ) : (
                            userSearchResults.map((u) => {
                              const isSelected = selectedUsers.some((sel) => sel.id === u.id);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => toggleUserSelection(u)}
                                  className={cn(
                                    "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-muted transition-colors cursor-pointer",
                                    isSelected && "bg-primary/10",
                                  )}
                                >
                                  <div className="min-w-0 flex-1 mr-2">
                                    <div className="font-medium text-foreground truncate">
                                      {u.name || u.email}
                                    </div>
                                    {u.name && (
                                      <div className="text-[11px] text-muted-foreground truncate">
                                        {u.email}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                                      <Smartphone size={10} />
                                      {u.deviceCount ?? 0}
                                    </Badge>
                                    {isSelected ? (
                                      <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                        <Check size={10} />
                                      </div>
                                    ) : (
                                      <div className="h-4 w-4 rounded-full border border-border" />
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Users Chips */}
                    {selectedUsers.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {selectedUsers.length} recipient{selectedUsers.length > 1 ? "s" : ""} selected
                          </span>
                          <button
                            type="button"
                            onClick={clearAllSelectedUsers}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 size={11} /> Clear all
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 rounded-xl border border-border/60 bg-muted/20">
                          {selectedUsers.map((u) => {
                            const hasNoDevices = channel === "push" && (u.deviceCount ?? 0) === 0;
                            return (
                              <span
                                key={u.id}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                                  hasNoDevices
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                                    : "bg-background border-border text-foreground",
                                )}
                              >
                                <span className="truncate max-w-[130px]">
                                  {u.name || u.email}
                                </span>
                                {hasNoDevices && (
                                  <span title="No devices registered for push notification" className="inline-flex items-center">
                                    <AlertCircle size={11} className="text-amber-500" />
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeSelectedUser(u.id)}
                                  className="rounded-full p-0.5 hover:bg-muted-foreground/20 cursor-pointer"
                                  title="Remove recipient"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        No recipients selected yet. Search above to add specific users.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Attune update…"
                  maxLength={120}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Body
                </label>
                <Textarea
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Announce news or send important notification…"
                  maxLength={500}
                />
              </div>
            </div>

            {result ? (
              <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {result}
              </p>
            ) : null}

            <Button
              className="mt-5 w-full cursor-pointer"
              onClick={send}
              disabled={isSendDisabled}
            >
              <Send size={14} className="mr-2" />
              {sending ? "Queueing…" : "Send campaign"}
            </Button>
            {!can("campaigns", "create") && (
              <p className="mt-2 text-xs text-muted-foreground text-center italic">
                Read-only access (sending restricted)
              </p>
            )}
          </Card>
        </div>

        {/* History Table Column: On large screens occupies 7 cols (or 8 on xl), stacks below on small screens */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/60 bg-muted/10">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground">Delivery History</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
                  {totalCount}
                </span>
              </div>
              <ColumnVisibilityDropdown
                columns={CAMPAIGN_COLUMNS}
                isVisible={isVisible}
                onToggle={toggleColumn}
                onReset={resetColumns}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <Th className="w-8"></Th>
                    {isVisible("recipient") && <Th>Recipient</Th>}
                    {isVisible("channel") && <Th>Channel</Th>}
                    {isVisible("status") && <Th>Status</Th>}
                    {isVisible("detail") && <Th>Detail</Th>}
                    {isVisible("at") && <Th>Sent At</Th>}
                  </tr>
                </thead>
                <tbody>
                  {sends.map((s) => {
                    const isExpanded = expandedRowIds.has(s.id);
                    return (
                      <React.Fragment key={s.id}>
                        <tr className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
                          <Td className="w-8 pr-0">
                            <button
                              type="button"
                              onClick={() => toggleRowExpanded(s.id)}
                              className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                              title={isExpanded ? "Collapse details" : "Expand details"}
                            >
                              <ChevronRight
                                size={14}
                                className={cn(
                                  "transition-transform duration-200",
                                  isExpanded && "rotate-90 text-primary",
                                )}
                              />
                            </button>
                          </Td>
                          {isVisible("recipient") && (
                            <Td className="font-medium text-foreground">{s.email}</Td>
                          )}
                          {isVisible("channel") && (
                            <Td>
                              <Badge variant="secondary">{s.channel}</Badge>
                            </Td>
                          )}
                          {isVisible("status") && (
                            <Td>
                              <Badge
                                variant={
                                  s.status === "sent"
                                    ? "success"
                                    : s.status === "failed"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {s.status}
                              </Badge>
                            </Td>
                          )}
                          {isVisible("detail") && (
                            <Td className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {s.error ?? "—"}
                            </Td>
                          )}
                          {isVisible("at") && (
                            <Td className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(s.sentAt).toLocaleString()}
                            </Td>
                          )}
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/20 border-b border-border/60">
                            <Td colSpan={visibleCount + 1} className="py-3 px-4">
                              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 shadow-2xs">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-foreground">
                                    Delivery Log Details
                                  </span>
                                  <span className="text-muted-foreground">
                                    {new Date(s.sentAt).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground font-mono bg-muted/40 p-2.5 rounded-lg break-all">
                                  {s.error ? (
                                    <span className="text-destructive font-medium">
                                      Error: {s.error}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      Status: {s.status} — Delivered successfully via {s.channel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {sends.length === 0 ? (
                    <tr>
                      <Td
                        colSpan={visibleCount + 1}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No campaigns sent yet.
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
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading campaigns…</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
