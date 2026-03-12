"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  Activity,
  FlaskConical,
  Settings,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Radio,
  ChevronsUpDown,
  Check,
  Building2,
  Target,
  HeartPulse,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { fetcher } from "@/lib/api-client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/team-chat", label: "Team Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/hierarchy", label: "Hierarchy", icon: GitBranch },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/messages", label: "Messages", icon: Radio },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/heartbeats", label: "Heartbeats", icon: HeartPulse },
  { href: "/budgets", label: "Budgets", icon: DollarSign },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/ab-tests", label: "A/B Tests", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { data: memberships } = useSWR("/api/workspaces/mine", fetcher);
  const { data: currentWs } = useSWR("/api/workspaces/current", fetcher);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const workspaces = Array.isArray(memberships)
    ? memberships.map((m: any) => m.workspace)
    : [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchWorkspace = (workspaceId: string) => {
    document.cookie = `cohortis_workspace_id=${workspaceId};path=/;max-age=31536000`;
    setOpen(false);
    window.location.reload();
  };

  if (workspaces.length <= 1 && collapsed) return null;

  return (
    <div className="relative px-2 mb-2" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-secondary transition-colors ${
          collapsed ? "justify-center" : ""
        }`}
        title={collapsed ? currentWs?.name : undefined}
      >
        <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
          <Building2 className="w-3 h-3 text-primary" />
        </div>
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-xs font-medium truncate">
              {currentWs?.name || "Workspace"}
            </span>
            <ChevronsUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </>
        )}
      </button>

      {open && workspaces.length > 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {workspaces.map((ws: any) => {
            const isActive = ws.id === currentWs?.id;
            return (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex-1 truncate">{ws.name}</span>
                {isActive && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-border bg-card transition-all duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <GitBranch className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight">
              Cohortis AI
            </span>
          )}
        </div>

        {/* Workspace Switcher */}
        <div className="pt-3">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-1 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
