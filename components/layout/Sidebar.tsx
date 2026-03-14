"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { CalendarDays, Inbox, LayoutGrid, Settings, LogOut, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/week", label: "Week", icon: LayoutGrid },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex flex-col border-r border-border bg-card h-full shrink-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm tracking-tight">TaskFlow</span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors",
                pathname === href || pathname.startsWith(href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </div>
          </Link>
        ))}
      </nav>

      <div className="p-2 border-t border-border space-y-0.5">
        <Link href="/settings">
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors",
              pathname.startsWith("/settings")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground px-3"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
