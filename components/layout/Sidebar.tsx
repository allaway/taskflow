"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { CalendarDays, Inbox, LayoutGrid, Settings, LogOut, Zap } from "lucide-react";

const navItems = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/week",  label: "Week",  icon: LayoutGrid },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 flex flex-col shrink-0 border-r border-border/60 bg-sidebar">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Zap className="h-3.5 w-3.5 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">TaskFlow</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "?");
          return (
            <Link key={href} href={href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}>
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-border/60 space-y-0.5">
        <Link href="/settings">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150",
            pathname.startsWith("/settings")
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}>
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
