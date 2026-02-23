import type { Metadata } from "next";
import "./globals.css";
import { ZeroCarbonFooter } from "@/components/ui/zerocarbon-footer";
import { ZeroCarbonNavbar } from "@/components/ui/zerocarbon-navbar";
import { GlobalTilesBackground } from "@/components/ui/global-tiles-background";

export const metadata: Metadata = {
  title: "ZeroCarbon",
  description:
    "ZeroCarbon | Offset emissions, discover verified climate projects, and scale climate action",
  keywords:
    "carbon credits, climate tech, carbon offset, carbon marketplace, sustainability, emissions",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon/favicon.ico",
    apple: "/favicon/apple-touch-icon.png",
    other: [{ rel: "manifest", url: "/favicon/site.webmanifest" }],
  },
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
      </body>
    </html>
  );
}
