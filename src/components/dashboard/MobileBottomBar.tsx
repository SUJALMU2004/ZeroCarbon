"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftRight, Building2, Globe2, Home, User } from "lucide-react";

interface MobileBottomBarProps {
  currentMode: "buyer" | "seller";
}

export default function MobileBottomBar({
  currentMode,
}: MobileBottomBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const homeRoute =
    currentMode === "buyer" ? "/dashboard/buyer" : "/dashboard/seller";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around overflow-visible border-t border-gray-100 bg-white md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Link
        href={homeRoute}
        className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 transition-colors ${
          pathname.startsWith("/dashboard")
            ? "text-green-600"
            : "text-gray-400"
        }`}
      >
        <Home className="h-5 w-5" />
        <span className="text-[10px] leading-none">Home</span>
      </Link>

      <Link
        href="/projects/map"
        className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 transition-colors ${
          pathname === "/projects/map" ? "text-green-600" : "text-gray-400"
        }`}
      >
        <Globe2 className="h-5 w-5" />
        <span className="text-[10px] leading-none">Satellite</span>
      </Link>

      <div className="relative flex flex-1 min-w-0 flex-col items-center justify-center">
        <button
          onClick={() =>
            router.push(
              currentMode === "buyer" ? "/dashboard/seller" : "/dashboard/buyer",
            )
          }
          className="mt-[-1.25rem] flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-green-600 shadow-lg shadow-green-200 transition-transform active:scale-95"
          aria-label="Switch mode"
          type="button"
        >
          <ArrowLeftRight className="h-5 w-5 text-white" />
        </button>
        <span className="mt-0.5 text-[10px] font-semibold leading-none text-green-600">
          {currentMode === "buyer" ? "Buyer" : "Seller"}
        </span>
      </div>

      <Link
        href="/verify-company"
        className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 transition-colors ${
          pathname.startsWith("/verify-company")
            ? "text-green-600"
            : "text-gray-400"
        }`}
      >
        <Building2 className="h-5 w-5" />
        <span className="text-[10px] leading-none">Company</span>
      </Link>

      <Link
        href="/profile"
        className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 transition-colors ${
          pathname.startsWith("/profile") ? "text-green-600" : "text-gray-400"
        }`}
      >
        <User className="h-5 w-5" />
        <span className="text-[10px] leading-none">Profile</span>
      </Link>
    </nav>
  );
}
