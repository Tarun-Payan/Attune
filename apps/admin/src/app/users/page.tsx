"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Send, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AdminRole, UserRow } from "@attune/types";
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
  Td,
  Th,
  useColumnVisibility,
} from "@/components/ui";
import { toast } from "sonner";

const USER_COLUMNS: ColumnDef[] = [
  { id: "user", label: "User", defaultVisible: true, required: true },
  { id: "role", label: "Admin Role", defaultVisible: true },
  { id: "joined", label: "Joined", defaultVisible: true },
  { id: "topics", label: "Topics", defaultVisible: true },
  { id: "devices", label: "Devices", defaultVisible: true },
  { id: "lastActive", label: "Last active", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "actions", label: "Actions", defaultVisible: true },
];

export default function UsersPage() {
  const { can, user: currentAdmin, loading: permsLoading } = usePermissions();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Role Assignment Modal
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const { isVisible, toggleColumn, resetColumns, visibleCount } = useColumnVisibility(
    "users",
    USER_COLUMNS,
  );

  const load = useCallback(() => {
    if (!can("users", "read")) return;
    setLoading(true);
    api.users
      .list({
        q: q.trim() || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      .then((d) => {
        setUsers(d.users);
        setTotalCount(d.count);
      })
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, [can, q, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (can("roles", "read")) {
      api.roles.list().then((res) => setRoles(res.roles)).catch(() => {});
    }
  }, [can]);

  const handleSearchChange = (val: string) => {
    setQ(val);
    setPage(1);
  };

  const toggleDisabled = async (u: UserRow) => {
    const disable = !u.disabledAt;
    if (disable && !window.confirm(`Disable ${u.email}? They'll be logged out everywhere.`)) return;
    try {
      await api.users.patch(u.id, { disabled: disable });
      toast.success(disable ? "User disabled" : "User enabled");
      load();
    } catch {
      toast.error("Failed to update user status");
    }
  };

  const openRoleModal = (u: UserRow) => {
    setSelectedUser(u);
    setSelectedRoleId(u.adminRoleId ?? "");
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;
    setAssigning(true);
    try {
      const roleId = selectedRoleId ? selectedRoleId : null;
      await api.users.assignRole(selectedUser.id, roleId);
      toast.success("Admin role updated successfully");
      setSelectedUser(null);
      load();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "body" in err
        ? (err as { body?: { error?: string } }).body?.error
        : "Failed to assign role";
      toast.error(msg ?? "Failed to assign role");
    } finally {
      setAssigning(false);
    }
  };

  if (!permsLoading && !can("users", "read")) {
    return <AccessDenied feature="Users" />;
  }

  const canUpdateUsers = can("users", "update");
  const canManageRoles = can("roles", "write");
  const canSendCampaign = can("campaigns", "create");

  return (
    <div className="space-y-6">
      <PageHeader title="Users" subtitle="Accounts, activity, and administrative access control" />

      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search by email or name…"
          value={q}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-md flex-1"
        />
        <ColumnVisibilityDropdown
          columns={USER_COLUMNS}
          isVisible={isVisible}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-187.5">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {isVisible("user") && <Th>User</Th>}
                {isVisible("role") && <Th>Admin Role</Th>}
                {isVisible("joined") && <Th>Joined</Th>}
                {isVisible("topics") && <Th>Topics</Th>}
                {isVisible("devices") && <Th>Devices</Th>}
                {isVisible("lastActive") && <Th>Last active</Th>}
                {isVisible("status") && <Th>Status</Th>}
                {isVisible("actions") && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {isVisible("user") && (
                    <Td>
                      <div className="font-medium text-foreground">{u.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </Td>
                  )}
                  {isVisible("role") && (
                    <Td>
                      {u.adminRoleName ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="default" className="text-xs font-semibold">
                            <ShieldCheck size={12} className="mr-1 inline" /> {u.adminRoleName}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No Admin Role</span>
                      )}
                    </Td>
                  )}
                  {isVisible("joined") && (
                    <Td className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </Td>
                  )}
                  {isVisible("topics") && (
                    <Td className="text-muted-foreground font-mono text-xs">{u.topicCount}</Td>
                  )}
                  {isVisible("devices") && (
                    <Td className="text-muted-foreground font-mono text-xs">{u.deviceCount}</Td>
                  )}
                  {isVisible("lastActive") && (
                    <Td className="text-xs text-muted-foreground">
                      {u.lastActive ? new Date(u.lastActive).toLocaleString() : "never"}
                    </Td>
                  )}
                  {isVisible("status") && (
                    <Td>
                      {u.disabledAt ? (
                        <Badge variant="destructive">disabled</Badge>
                      ) : (
                        <Badge variant="success">active</Badge>
                      )}
                    </Td>
                  )}
                  {isVisible("actions") && (
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canSendCampaign && (
                          <Link
                            href={`/campaigns?userId=${u.id}&name=${encodeURIComponent(u.name || "")}&email=${encodeURIComponent(u.email)}`}
                            className="inline-flex items-center justify-center rounded-xl border border-input bg-background hover:bg-muted text-foreground text-xs h-8 px-2.5 gap-1.5 transition-colors"
                            title="Send direct campaign or push notification to this user"
                          >
                            <Send size={12} />
                            <span>Message</span>
                          </Link>
                        )}
                        {canManageRoles && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoleModal(u)}
                            className="h-8 gap-1 text-xs"
                            title="Assign Admin Role"
                          >
                            <Shield size={13} /> Role
                          </Button>
                        )}
                        {canUpdateUsers && (
                          <Button
                            variant={u.disabledAt ? "outline" : "destructive"}
                            size="sm"
                            onClick={() => toggleDisabled(u)}
                            className="h-8 text-xs"
                          >
                            {u.disabledAt ? "Enable" : "Disable"}
                          </Button>
                        )}
                        {!canManageRoles && !canUpdateUsers && !canSendCampaign && (
                          <span className="text-xs text-muted-foreground italic py-1">View only</span>
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
              {users?.length === 0 ? (
                <tr>
                  <Td colSpan={visibleCount} className="py-8 text-center text-muted-foreground">
                    No users found.
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

      {/* Role Assignment Modal */}
      <Modal
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={`Assign Role: ${selectedUser?.name || selectedUser?.email || ""}`}
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Users with an administrative role gain access to the admin console based on the role&apos;s assigned permissions. Setting to &quot;No Admin Role&quot; revokes console access.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Select Role
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="">No Admin Role (Revoke Console Access)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.isSystem ? "(System)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setSelectedUser(null)} disabled={assigning}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={assigning}>
              {assigning ? "Saving..." : "Save Role"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
