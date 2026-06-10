"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { CalendarDays, Inbox, LayoutGrid, Settings, LogOut, Zap, BarChart2, Search, Columns3, Bot, Plus, FolderOpen } from "lucide-react";
import { SearchModal } from "@/components/tasks/SearchModal";

const navItems = [
  { href: "/today",  label: "Today",  icon: CalendarDays },
  { href: "/week",   label: "Week",   icon: LayoutGrid },
  { href: "/inbox",  label: "Inbox",  icon: Inbox },
  { href: "/board",  label: "Board",  icon: Columns3 },
  { href: "/review", label: "Review", icon: BarChart2 },
];

const PROJECT_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#3b82f6","#64748b",
];

interface ProjectEntry {
  id: string;
  name: string;
  color: string;
  _count?: { tasks: number };
}

export function Sidebar() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const refreshAttention = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-sessions?status=AWAITING_INPUT&status=NEEDS_REVIEW");
      if (res.ok) {
        const sessions = await res.json();
        setAttentionCount(sessions.length);
      }
    } catch { /* offline — ignore */ }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshAttention();
    refreshProjects();
    const interval = setInterval(refreshAttention, 60000);
    return () => clearInterval(interval);
  }, [refreshAttention, refreshProjects, pathname]);

  async function createProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (res.ok) {
      setNewProjectName("");
      setAddingProject(false);
      refreshProjects();
    }
  }

  return (
    <>
      <aside className="w-[220px] flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-sidebar-border shrink-0">
          <div className="h-7 w-7 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Zap className="h-[15px] w-[15px] text-sidebar-primary-foreground fill-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold text-[14px] tracking-tight text-sidebar-foreground">TaskFlow</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-px overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/30 px-3 mb-2">
            Navigation
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "?");
            return (
              <Link key={href} href={href}>
                <div className={cn(
                  "relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}>
                  {active && (
                    <span className="absolute left-0 inset-y-2 w-0.5 rounded-r-full bg-sidebar-primary" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-sidebar-primary" : "")} />
                  {label}
                </div>
              </Link>
            );
          })}

          {/* Agents — work needing your attention */}
          <Link href="/agents">
            <div className={cn(
              "relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150",
              pathname === "/agents"
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            )}>
              {pathname === "/agents" && (
                <span className="absolute left-0 inset-y-2 w-0.5 rounded-r-full bg-sidebar-primary" />
              )}
              <Bot className={cn("h-4 w-4 shrink-0", pathname === "/agents" ? "text-sidebar-primary" : "")} />
              <span className="flex-1">Agents</span>
              {attentionCount > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-500/90 text-white"
                  data-testid="agent-attention-count"
                >
                  {attentionCount}
                </span>
              )}
            </div>
          </Link>

          {/* Search */}
          <div className="mt-2 pt-2 border-t border-sidebar-border/50">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-150"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Search</span>
              <kbd className="text-[10px] font-mono text-sidebar-foreground/25 bg-sidebar-accent/60 px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>
          </div>

          {/* Projects */}
          <div className="mt-3 pt-3 border-t border-sidebar-border/50">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/30">
                Projects
              </p>
              <button
                onClick={() => setAddingProject((v) => !v)}
                className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                title="New project"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {addingProject && (
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createProject();
                  if (e.key === "Escape") { setAddingProject(false); setNewProjectName(""); }
                }}
                placeholder="Project name…"
                className="w-full mb-1 px-3 py-1.5 text-[13px] rounded-lg bg-sidebar-accent/60 text-sidebar-foreground placeholder:text-sidebar-foreground/30 outline-none"
              />
            )}
            {projects.map((p) => {
              const href = `/board?project=${p.id}`;
              return (
                <Link key={p.id} href={href}>
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-150">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 truncate">{p.name}</span>
                    {(p._count?.tasks ?? 0) > 0 && (
                      <span className="text-[10px] text-sidebar-foreground/30">{p._count!.tasks}</span>
                    )}
                  </div>
                </Link>
              );
            })}
            {projects.length === 0 && !addingProject && (
              <p className="px-3 text-[11px] text-sidebar-foreground/25 flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3" /> No projects yet
              </p>
            )}
          </div>
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-sidebar-border flex flex-col gap-px">
          <Link href="/settings">
            <div className={cn(
              "relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150",
              pathname.startsWith("/settings")
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            )}>
              {pathname.startsWith("/settings") && (
                <span className="absolute left-0 inset-y-2 w-0.5 rounded-r-full bg-sidebar-primary" />
              )}
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </div>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-150 w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
