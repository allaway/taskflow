import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-geist", weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "AI-powered daily task planner",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <SessionProvider>
          {children}
          <Toaster
            toastOptions={{
              classNames: {
                toast: "bg-card border-border text-foreground",
                description: "text-muted-foreground",
              },
            }}
            position="bottom-right"
          />
        </SessionProvider>
      </body>
    </html>
  );
}
