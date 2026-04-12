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
    <aside className="w-[212px] flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="h-[26px] w-[26px] rounded-[7px] bg-primary flex items-center justify-center shrink-0 shadow-[0_0_12px_-2px] shadow-primary/40">
            <Zap className="h-[13px] w-[13px] text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-semibold text-[13.5px] tracking-[-0.01em] text-foreground">TaskFlow</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-px">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "?");
          return (
            <Link key={href} href={href}>
              <div className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer",
                active
                  ? "bg-primary/[0.14] text-primary"
                  : "text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.055]"
              )}>
                <Icon className={cn("h-[15px] w-[15px] shrink-0", !active && "opacity-70")} />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-2.5 border-t border-sidebar-border space-y-px">
        <Link href="/settings">
          <div className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer",
            pathname.startsWith("/settings")
              ? "bg-primary/[0.14] text-primary"
              : "text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.055]"
          )}>
            <Settings className={cn("h-[15px] w-[15px] shrink-0", !pathname.startsWith("/settings") && "opacity-70")} />
            Settings
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.055] transition-all duration-150"
        >
          <LogOut className="h-[15px] w-[15px] shrink-0 opacity-70" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
