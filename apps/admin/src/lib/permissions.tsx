"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { AdminAction, AdminFeature, AdminPermission, AdminRole, AdminUserWithRole } from "@attune/types";
import { api, getStoredPermissions, getStoredRole, getStoredUser, getToken } from "./api";

interface PermissionContextValue {
  user: AdminUserWithRole | null;
  role: AdminRole | null;
  permissions: AdminPermission[];
  can: (feature: AdminFeature, action: AdminAction) => boolean;
  refreshPermissions: () => Promise<void>;
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextValue>({
  user: null,
  role: null,
  permissions: [],
  can: () => false,
  refreshPermissions: async () => {},
  loading: true,
});

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUserWithRole | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFromStorage = () => {
    setUser(getStoredUser());
    setRole(getStoredRole());
    setPermissions(getStoredPermissions());
  };

  const refreshPermissions = async () => {
    if (!getToken()) {
      setUser(null);
      setRole(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const data = await api.auth.me();
      setUser(data.user);
      setRole(data.role);
      setPermissions(data.permissions);
    } catch {
      loadFromStorage();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFromStorage();
    refreshPermissions();
  }, []);

  const can = (feature: AdminFeature, action: AdminAction): boolean => {
    if (!permissions || permissions.length === 0) return false;
    return permissions.some((p) => p.feature === feature && p.action === action);
  };

  return (
    <PermissionContext.Provider
      value={{
        user,
        role,
        permissions,
        can,
        refreshPermissions,
        loading,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export function AccessDenied({ feature }: { feature?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4 shadow-xs">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        You do not have permission to access {feature ? `the ${feature} section` : "this page"}. Please contact an administrator to update your assigned role permissions.
      </p>
    </div>
  );
}
