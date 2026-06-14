import { Sidebar } from "@/components/layout/Sidebar";
import { CalendarSyncTrigger } from "@/components/calendar/CalendarSyncTrigger";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <CalendarSyncTrigger />
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
