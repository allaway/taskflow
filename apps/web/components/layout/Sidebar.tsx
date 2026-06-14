"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { CalendarDays, Inbox, LayoutGrid, Settings, LogOut, Zap, BarChart2, Search } from "lucide-react";
import { SearchModal } from "@/components/tasks/SearchModal";

const navItems = [
  { href: "/today",  label: "Today",  icon: CalendarDays },
  { href: "/week",   label: "Week",   icon: LayoutGrid },
  { href: "/inbox",  label: "Inbox",  icon: Inbox },
  { href: "/review", label: "Review", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

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
        <nav className="flex-1 px-3 py-4 flex flex-col gap-px">
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
