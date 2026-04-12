"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { CalendarDays, Inbox, LayoutGrid, Settings, LogOut, Zap, BarChart2 } from "lucide-react";

const navItems = [
  { href: "/today",  label: "Today",  icon: CalendarDays },
  { href: "/week",   label: "Week",   icon: LayoutGrid },
  { href: "/inbox",  label: "Inbox",  icon: Inbox },
  { href: "/review", label: "Review", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0"
               style={{ boxShadow: "0 0 16px -2px oklch(0.64 0.24 263 / 60%)" }}>
            <Zap className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight">TaskFlow</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-5 pb-3 flex flex-col gap-px">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-3 mb-2">
          Workspace
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "?");
          return (
            <Link key={href} href={href}>
              <div className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.05]"
              )}>
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-primary" />
                )}
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-sidebar-border flex flex-col gap-px">
        <Link href="/settings">
          <div className={cn(
            "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            pathname.startsWith("/settings")
              ? "bg-white/[0.08] text-foreground"
              : "text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.05]"
          )}>
            {pathname.startsWith("/settings") && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-primary" />
            )}
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.05] transition-all duration-150 w-full"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
