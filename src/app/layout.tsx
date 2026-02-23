import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ZeroCarbonFooter } from "@/components/ui/zerocarbon-footer";
import { ZeroCarbonNavbar } from "@/components/ui/zerocarbon-navbar";
import { GlobalTilesBackground } from "@/components/ui/global-tiles-background";

export const metadata: Metadata = {
  title: "ZeroCarbon",
  description:
    "ZeroCarbon | Offset emissions, discover verified climate projects, and scale climate action",
  keywords:
    "carbon credits, climate tech, carbon offset, carbon marketplace, sustainability, emissions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="relative min-h-screen bg-white text-slate-900 antialiased">
        <GlobalTilesBackground />
        <ZeroCarbonNavbar />
        <div className="relative z-10 min-h-screen pt-24 md:pt-28">{children}</div>
        <ZeroCarbonFooter />
        <Analytics />
      </body>
    </html>
  );
}
