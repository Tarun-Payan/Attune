"use client";

import { useEffect, useState } from "react";
import { Plus, Shield, ShieldAlert, ShieldCheck, Trash2, Edit, CheckSquare, Square } from "lucide-react";
import { ADMIN_ACTIONS, ADMIN_FEATURES, type AdminAction, type AdminFeature, type AdminPermission, type AdminRole } from "@attune/types";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Badge, Button, Card, Input, Modal, PageHeader, Table, Td, Th } from "@/components/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FEATURES_META: Record<AdminFeature, { label: string; description: string }> = {
  dashboard: { label: "Dashboard", description: "View platform telemetry, ingest health, and charts" },
  sources: { label: "Sources", description: "Manage ingestion feeds, connectors, and manual triggers" },
  topics: { label: "Topics & Tags", description: "Create and organize topics, subtopics, and tag taxonomies" },
  content: { label: "Content", description: "Moderate feed items, hide content, and dismiss user reports" },
  users: { label: "Users", description: "Search accounts, toggle moderation status, and assign roles" },
  campaigns: { label: "Campaigns", description: "Dispatch announcement notifications and view delivery logs" },
  settings: { label: "Settings", description: "Configure system ranking coefficients and moderation limits" },
  jobs: { label: "Jobs", description: "Inspect BullMQ workers, job telemetry, and Bull Board queues" },
  roles: { label: "Roles", description: "Manage admin roles, permission matrices, and user authorizations" },
  cache: { label: "Cache", description: "Inspect Redis memory, key namespaces, and cache eviction" },
  logs: { label: "Logs", description: "Inspect in-memory Redis log buffer, trace requests, and clear buffer" },
};


const ACTIONS_META: Record<AdminAction, { label: string; description: string }> = {
  read: { label: "Read", description: "View records" },
  create: { label: "Create", description: "Create records" },
  update: { label: "Update", description: "Edit records" },
  write: { label: "Write", description: "Delete / Trigger" },
};

export default function RolesPage() {
  const { can, refreshPermissions } = usePermissions();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await api.roles.list();
      setRoles(res.roles);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const openCreateModal = () => {
    setEditingRole(null);
    setFormName("");
    setFormDescription("");
    setSelectedPermissions(new Set());
    setIsModalOpen(true);
  };

  const openEditModal = (role: AdminRole) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormDescription(role.description ?? "");
    const permSet = new Set(role.permissions.map((p) => `${p.feature}:${p.action}`));
    setSelectedPermissions(permSet);
    setIsModalOpen(true);
  };

  const togglePermission = (feature: AdminFeature, action: AdminAction) => {
    const key = `${feature}:${action}`;
    const next = new Set(selectedPermissions);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedPermissions(next);
  };

  const toggleAllForFeature = (feature: AdminFeature) => {
    const allSelected = ADMIN_ACTIONS.every((a) => selectedPermissions.has(`${feature}:${a}`));
    const next = new Set(selectedPermissions);
    for (const a of ADMIN_ACTIONS) {
      const key = `${feature}:${a}`;
      if (allSelected) {
        next.delete(key);
      } else {
        next.add(key);
      }
    }
    setSelectedPermissions(next);
  };

  const toggleAllForAction = (action: AdminAction) => {
    const allSelected = ADMIN_FEATURES.every((f) => selectedPermissions.has(`${f}:${action}`));
    const next = new Set(selectedPermissions);
    for (const f of ADMIN_FEATURES) {
      const key = `${f}:${action}`;
      if (allSelected) {
        next.delete(key);
      } else {
        next.add(key);
      }
    }
    setSelectedPermissions(next);
  };

  const selectAll = () => {
    const next = new Set<string>();
    for (const f of ADMIN_FEATURES) {
      for (const a of ADMIN_ACTIONS) {
        next.add(`${f}:${a}`);
      }
    }
    setSelectedPermissions(next);
  };

  const clearAll = () => {
    setSelectedPermissions(new Set());
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Role name is required");
      return;
    }

    const permissions: AdminPermission[] = Array.from(selectedPermissions).map((key) => {
      const [feature, action] = key.split(":") as [AdminFeature, AdminAction];
      return { feature, action };
    });

    setSaving(true);
    try {
      if (editingRole) {
        await api.roles.patch(editingRole.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          permissions,
        });
        toast.success("Role updated successfully");
      } else {
        await api.roles.create({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          permissions,
        });
        toast.success("Role created successfully");
      }
      setIsModalOpen(false);
      await loadRoles();
      await refreshPermissions();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "body" in err
        ? (err as { body?: { error?: string } }).body?.error
        : "Operation failed";
      toast.error(msg ?? "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: AdminRole) => {
    if (role.isSystem) {
      toast.error("System roles cannot be deleted");
      return;
    }

    if (!confirm(`Are you sure you want to delete the role "${role.name}"? Users with this role will lose their admin access.`)) {
      return;
    }

    try {
      await api.roles.delete(role.id);
      toast.success("Role deleted successfully");
      await loadRoles();
      await refreshPermissions();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "body" in err
        ? (err as { body?: { error?: string } }).body?.error
        : "Failed to delete role";
      toast.error(msg ?? "Delete failed");
    }
  };

  if (!can("roles", "read")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
        <ShieldAlert size={48} className="text-destructive mb-4" />
        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          You do not have permission to view administrative roles. Contact an administrator to adjust your permissions.
        </p>
      </div>
    );
  }

  const canCreate = can("roles", "create");
  const canUpdate = can("roles", "update");
  const canWrite = can("roles", "write");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Roles & Permissions"
          subtitle="Manage administrative roles and configure feature-level permissions (Read, Create, Update, Write)"
        />
        {canCreate && (
          <Button onClick={openCreateModal} className="shrink-0 gap-2">
            <Plus size={16} /> Create Role
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Roles</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{roles.length}</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System Roles</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {roles.filter((r) => r.isSystem).length}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Protected system presets</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Roles</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {roles.filter((r) => !r.isSystem).length}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Tailored role definitions</p>
        </Card>
      </div>

      {/* Roles List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No roles found.</div>
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <Th>Role Name</Th>
                <Th>Description</Th>
                <Th>Assigned Users</Th>
                <Th>Permissions Count</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{r.name}</span>
                      {r.isSystem && (
                        <Badge variant="default" className="text-[10px] px-2 py-0.5">
                          System
                        </Badge>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs text-muted-foreground">{r.description || "—"}</span>
                  </Td>
                  <Td>
                    <span className="text-xs font-medium text-foreground">{r.usersCount ?? 0} users</span>
                  </Td>
                  <Td>
                    <Badge variant="secondary" className="text-xs">
                      {r.permissions.length} / {ADMIN_FEATURES.length * ADMIN_ACTIONS.length} actions
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(r)}
                          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          title="Edit role"
                        >
                          <Edit size={14} /> Edit
                        </Button>
                      )}
                      {canWrite && !r.isSystem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(r)}
                          className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                          title="Delete role"
                        >
                          <Trash2 size={14} /> Delete
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Create / Edit Role Modal with Permission Matrix */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRole ? `Edit Role: ${editingRole.name}` : "Create New Role"}
        className="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Role Name *
              </label>
              <Input
                placeholder="e.g. Content Moderator, Analyst"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={editingRole?.isSystem}
                className="text-sm"
              />
              {editingRole?.isSystem && (
                <p className="mt-1 text-[11px] text-muted-foreground">The name of a system role cannot be modified.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Description
              </label>
              <Input
                placeholder="Brief summary of permissions and scope"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Matrix Controls */}
          <div className="flex items-center justify-between border-t border-b border-border py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Permission Matrix</h3>
              <p className="text-xs text-muted-foreground">Select actions allowed for each administrative feature</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="xs" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="xs" onClick={clearAll}>
                Clear All
              </Button>
            </div>
          </div>

          {/* Interactive Matrix Table */}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[200px]">
                    Feature
                  </th>
                  {ADMIN_ACTIONS.map((action) => (
                    <th key={action} className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAllForAction(action)}
                        className="inline-flex flex-col items-center hover:opacity-80 transition-opacity cursor-pointer"
                        title={`Toggle all ${action} permissions`}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                          {ACTIONS_META[action].label}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {ACTIONS_META[action].description}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ADMIN_FEATURES.map((feature) => {
                  const meta = FEATURES_META[feature];
                  const allFeatureSelected = ADMIN_ACTIONS.every((a) => selectedPermissions.has(`${feature}:${a}`));

                  return (
                    <tr key={feature} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleAllForFeature(feature)}
                          className="flex items-center gap-2 text-left cursor-pointer group"
                        >
                          <span className="text-muted-foreground group-hover:text-primary transition-colors">
                            {allFeatureSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </span>
                          <div>
                            <div className="font-medium text-foreground text-xs sm:text-sm">{meta.label}</div>
                            <div className="text-[11px] text-muted-foreground hidden sm:block">{meta.description}</div>
                          </div>
                        </button>
                      </td>

                      {ADMIN_ACTIONS.map((action) => {
                        const key = `${feature}:${action}`;
                        const isChecked = selectedPermissions.has(key);

                        return (
                          <td key={action} className="py-3 px-4 text-center">
                            <label className="inline-flex items-center justify-center p-2 rounded-xl hover:bg-muted/60 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(feature, action)}
                                className="h-4 w-4 rounded-md border-border text-primary focus:ring-primary/40 cursor-pointer"
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
