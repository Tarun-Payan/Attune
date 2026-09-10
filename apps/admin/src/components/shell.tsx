"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellRing,
  Bookmark,
  Database,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings,
  Tag,
  Users,
  ShieldCheck,
  User as UserIcon,
  X,
} from "lucide-react";
import type { AdminFeature } from "@attune/types";
import { clearToken, getToken, resolveAvatarUrl } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import { ThemeToggle } from "./ThemeToggle";

const ROUTE_NAMES: Record<string, string> = {
  sources: "Sources",
  topics: "Topics & Tags",
  content: "Content",
  users: "Users",
  campaigns: "Campaigns",
  settings: "Settings",
  jobs: "Jobs",
  roles: "Roles & Permissions",
  cache: "Cache Console",
  profile: "Profile & Security",
  "change-email": "Change Email",
};

const NAV: Array<{
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  feature: AdminFeature;
}> = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard, feature: "dashboard" },
  { href: "/sources", label: "Sources", Icon: Plug, feature: "sources" },
  { href: "/topics", label: "Topics & Tags", Icon: Tag, feature: "topics" },
  { href: "/content", label: "Content", Icon: Newspaper, feature: "content" },
  { href: "/users", label: "Users", Icon: Users, feature: "users" },
  { href: "/campaigns", label: "Campaigns", Icon: BellRing, feature: "campaigns" },
  { href: "/roles", label: "Roles", Icon: ShieldCheck, feature: "roles" },
  { href: "/jobs", label: "Jobs", Icon: Bookmark, feature: "jobs" },
  { href: "/cache", label: "Cache", Icon: Database, feature: "cache" },
  { href: "/settings", label: "Settings", Icon: Settings, feature: "settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, can, loading: permsLoading } = usePermissions();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const ok = Boolean(getToken());
    setAuthed(ok);
    try {
      const saved = localStorage.getItem("attune_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // localStorage may fail in restricted environments
    }
    setReady(true);
    if (!ok && pathname !== "/login") router.replace("/login");
  }, [pathname, router]);

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("attune_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut: Ctrl+B / Cmd+B toggles sidebar, Escape closes mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleCollapsed();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  if (pathname === "/login") return <>{children}</>;
  if (!ready) return null;
  if (!authed) return null;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:z-30 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-300 ease-in-out",
          isCollapsed ? "w-60 md:w-16" : "w-60",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-14 items-center border-b border-sidebar-border/60 px-4">
          {/* Expanded / Mobile header view */}
          <div className={cn("flex w-full items-center justify-between", isCollapsed && "md:hidden")}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <House size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold tracking-tight text-foreground leading-none">attune</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                  Admin Console
                </div>
              </div>
            </div>
            {/* Desktop collapse button */}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={17} />
            </button>
            {/* Mobile drawer close button */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="flex md:hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
              title="Close menu"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Desktop Collapsed header view */}
          {isCollapsed && (
            <div className="hidden md:flex w-full items-center justify-center">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
                title="Expand sidebar (Ctrl+B)"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen size={18} />
                <div className="pointer-events-none absolute left-full z-50 ml-3 hidden rounded-lg bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md ring-1 ring-border group-hover:block whitespace-nowrap">
                  Expand sidebar (Ctrl+B)
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Navigation items */}
        <nav className={cn("mt-3 flex-1 space-y-1.5 transition-all", isCollapsed ? "px-3 md:px-2" : "px-3")}>
          {NAV.filter((item) => permsLoading || can(item.feature, "read")).map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "group relative flex items-center rounded-2xl text-sm font-medium transition-all",
                  isCollapsed
                    ? "gap-3 px-3.5 py-2 md:h-10 md:w-10 md:mx-auto md:justify-center md:px-0 md:py-0"
                    : "gap-3 px-3.5 py-2",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                )}
              >
                <Icon size={16} className={cn("shrink-0", active ? "text-primary" : undefined)} />
                <span className={cn("truncate", isCollapsed && "md:hidden")}>{label}</span>
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full z-50 ml-3 hidden rounded-lg bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md ring-1 ring-border md:group-hover:block whitespace-nowrap">
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom logout section */}
        <div className={cn("border-t border-sidebar-border/60 transition-all", isCollapsed ? "p-3 md:p-2" : "p-3")}>
          <button
            type="button"
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
            title={isCollapsed ? "Log out" : undefined}
            className={cn(
              "group relative flex items-center rounded-2xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer",
              isCollapsed
                ? "w-full gap-3 px-3.5 py-2 md:h-10 md:w-10 md:mx-auto md:justify-center md:px-0 md:py-0"
                : "w-full gap-3 px-3.5 py-2"
            )}
          >
            <LogOut size={16} className="shrink-0" />
            <span className={cn("truncate", isCollapsed && "md:hidden")}>Log out</span>
            {isCollapsed && (
              <div className="pointer-events-none absolute left-full z-50 ml-3 hidden rounded-lg bg-popover px-2.5 py-1 text-xs font-medium text-destructive shadow-md ring-1 ring-border md:group-hover:block whitespace-nowrap">
                Log out
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-[margin-left] duration-300 ease-in-out",
          isCollapsed ? "md:ml-16" : "md:ml-60",
          "ml-0"
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-4 md:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setIsMobileOpen((prev) => !prev)}
              className="flex md:hidden h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Toggle navigation"
              aria-label="Toggle navigation"
            >
              <Menu size={18} />
            </button>

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  {pathname === "/" ? (
                    <BreadcrumbPage>Dashboard</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {pathname !== "/" &&
                  pathname
                    .split("/")
                    .filter(Boolean)
                    .map((segment, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      const href = `/${arr.slice(0, idx + 1).join("/")}`;
                      const title = ROUTE_NAMES[segment] ?? segment.replace(/-/g, " ");

                      return (
                        <React.Fragment key={href}>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            {isLast ? (
                              <BreadcrumbPage className="capitalize">{title}</BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink href={href} className="capitalize">
                                {title}
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                        </React.Fragment>
                      );
                    })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-primary/10 text-primary font-bold text-xs uppercase overflow-hidden shadow-2xs hover:border-primary hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer outline-none"
                  title="Account menu"
                  aria-label="Account menu"
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveAvatarUrl(user.avatarUrl)!}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.name ? user.name[0] : user.email[0]
                  )}
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-64 p-1.5 rounded-2xl shadow-xl border-border bg-popover text-popover-foreground"
                >
                  {/* User summary header */}
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl mb-1">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-primary font-bold text-sm uppercase overflow-hidden">
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveAvatarUrl(user.avatarUrl)!}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user.name ? user.name[0] : user.email[0]
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-foreground leading-tight">
                        {user.name || user.email.split("@")[0]}
                      </div>
                      <div className="truncate text-xs text-muted-foreground leading-tight mt-0.5">
                        {user.email}
                      </div>
                      <div className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary/15 text-primary">
                        {role?.name ?? "Admin"}
                      </div>
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => router.push("/profile")}
                      className="cursor-pointer gap-2.5 py-2.5 rounded-xl"
                    >
                      <UserIcon size={16} className="text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">Manage Profile</span>
                        <span className="text-[10px] text-muted-foreground">Avatar, email & password</span>
                      </div>
                    </DropdownMenuItem>

                    {can("settings", "read") && (
                      <DropdownMenuItem
                        onClick={() => router.push("/settings")}
                        className="cursor-pointer gap-2.5 py-2.5 rounded-xl"
                      >
                        <Settings size={16} className="text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">System Settings</span>
                          <span className="text-[10px] text-muted-foreground">Global application config</span>
                        </div>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      clearToken();
                      router.replace("/login");
                    }}
                    className="cursor-pointer gap-2.5 py-2.5 rounded-xl text-destructive focus:bg-destructive/10"
                  >
                    <LogOut size={16} />
                    <span className="text-xs font-semibold">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8 bg-muted/20">{children}</main>
      </div>
    </div>
  );
}
