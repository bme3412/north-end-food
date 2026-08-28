import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SiteHeader } from "@/components/SiteHeader";
import { AsOfTimeProvider } from "@/lib/asOfTime";
import { SavedProvider } from "@/lib/saved";
import { ServiceModeProvider } from "@/lib/serviceMode";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "North End Food",
  description: "Map and search every official menu in Boston's North End.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F8FA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-linen text-ink antialiased">
        <AsOfTimeProvider>
          <ServiceModeProvider>
            <SavedProvider>
              <SiteHeader />
              <main className="mobile-page">{children}</main>
              <MobileBottomNav />
            </SavedProvider>
          </ServiceModeProvider>
        </AsOfTimeProvider>
        <Analytics />
      </body>
    </html>
  );
}
