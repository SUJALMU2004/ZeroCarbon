import type { Metadata } from "next";
import "./globals.css";
import { ZeroCarbonFooter } from "@/components/ui/zerocarbon-footer";
import { ZeroCarbonNavbar } from "@/components/ui/zerocarbon-navbar";
import { GlobalTilesBackground } from "@/components/ui/global-tiles-background";

export const metadata: Metadata = {
  metadataBase: new URL("https://zerocarbonworld.vercel.app"),
  title: {
    default: "ZeroCarbon | Verified Carbon Credit Marketplace for Climate Action",
    template: "%s | ZeroCarbon",
  },
  description:
    "ZeroCarbon is a trusted carbon credit marketplace where companies offset emissions and project owners list verified climate projects. Buy, sell, and retire carbon credits transparently.",
  keywords: [
    "carbon credit marketplace",
    "buy carbon credits",
    "sell carbon credits",
    "verified carbon credits",
    "carbon offset platform",
    "climate tech startup",
    "emissions offset marketplace",
    "net zero solutions",
    "sustainability platform",
  ],
  authors: [{ name: "ZeroCarbon Team" }],
  creator: "ZeroCarbon",
  publisher: "ZeroCarbon",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "ZeroCarbon | Buy & Sell Verified Carbon Credits",
    description:
      "Offset emissions, discover verified climate projects, and scale climate impact with ZeroCarbon.",
    url: "https://zerocarbonworld.vercel.app",
    siteName: "ZeroCarbon",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ZeroCarbon Carbon Credit Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZeroCarbon | Carbon Credit Marketplace",
    description:
      "A transparent platform to buy, sell, and retire verified carbon credits.",
    images: ["/og-image.png"],
  },
  themeColor: "#0f172a",
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
