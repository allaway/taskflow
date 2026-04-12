import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-80 flex-col justify-between p-10 border-r border-border/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-[26px] w-[26px] rounded-[7px] bg-primary flex items-center justify-center shadow-[0_0_12px_-2px] shadow-primary/40">
            <Zap className="h-[13px] w-[13px] text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-semibold text-[13.5px] tracking-[-0.01em]">TaskFlow</span>
        </div>
        <div className="space-y-2.5">
          <p className="text-lg font-semibold leading-snug tracking-tight">
            Your AI-powered<br />daily planner.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Plan your day, delegate to AI, and stay in flow.
          </p>
        </div>
        <p className="text-xs text-muted-foreground/30">© 2025 TaskFlow</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div className="h-[26px] w-[26px] rounded-[7px] bg-primary flex items-center justify-center shadow-[0_0_12px_-2px] shadow-primary/40">
              <Zap className="h-[13px] w-[13px] text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="font-semibold text-[13.5px] tracking-[-0.01em]">TaskFlow</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
