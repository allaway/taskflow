import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — dark brand panel */}
      <div className="hidden lg:flex w-80 flex-col justify-between p-10 bg-sidebar shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Zap className="h-[15px] w-[15px] text-sidebar-primary-foreground fill-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold text-[14px] tracking-tight text-sidebar-foreground">TaskFlow</span>
        </div>
        <div className="space-y-3">
          <p className="text-xl font-semibold leading-snug tracking-tight text-sidebar-foreground">
            Your AI-powered<br />daily planner.
          </p>
          <p className="text-sm text-sidebar-foreground/50 leading-relaxed">
            Plan your day, delegate to AI, and stay in flow.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/25">© 2025 TaskFlow</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-[15px] w-[15px] text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="font-semibold text-[14px] tracking-tight">TaskFlow</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
