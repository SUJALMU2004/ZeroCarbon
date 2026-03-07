"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeftRight, Building2, LayoutDashboard, TreePine, User } from "lucide-react";

type DashboardMode = "buyer" | "seller";

export function MobileBottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [rotate, setRotate] = useState(0);

  const activeMode: DashboardMode = pathname?.includes("/seller") ? "seller" : "buyer";
  const isToggling = pendingRoute !== null && pendingRoute !== pathname;

  const overviewHref = activeMode === "buyer" ? "/dashboard/buyer" : "/dashboard/seller";
  const verifyHref = activeMode === "buyer" ? "/verify-company" : "/verify-project";

  const toggleMode = () => {
    if (isToggling) {
      return;
    }

    const targetRoute = activeMode === "buyer" ? "/dashboard/seller" : "/dashboard/buyer";
    setPendingRoute(targetRoute);
    setRotate((previous) => previous + 180);
    router.push(targetRoute);
  };

  const isOverviewActive = pathname === "/dashboard/buyer" || pathname === "/dashboard/seller";
  const isVerifyActive = pathname === "/verify-company" || pathname === "/verify-project";
  const isProfileActive = pathname?.startsWith("/profile") ?? false;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-start border-t border-gray-100 bg-white px-3 pt-1 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        type="button"
        onClick={() => router.push(overviewHref)}
        className="flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5"
      >
        <LayoutDashboard className={`h-5 w-5 ${isOverviewActive ? "text-green-600" : "text-gray-400"}`} />
        <span className={`text-[10px] leading-none ${isOverviewActive ? "font-semibold text-green-600" : "text-gray-400"}`}>
          Home
        </span>
      </button>

      <button
        type="button"
        onClick={toggleMode}
        className="flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5"
        disabled={isToggling}
      >
        <motion.span
          animate={{ rotate }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="-mt-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-200"
        >
          <ArrowLeftRight className="h-6 w-6" />
        </motion.span>
        <span className="mt-0.5 text-[10px] font-semibold leading-none text-green-600">
          {activeMode === "buyer" ? "Buyer" : "Seller"}
        </span>
      </button>

      <button
        type="button"
        onClick={() => router.push(verifyHref)}
        className="flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5"
      >
        {activeMode === "buyer" ? (
          <Building2 className={`h-5 w-5 ${isVerifyActive ? "text-green-600" : "text-gray-400"}`} />
        ) : (
          <TreePine className={`h-5 w-5 ${isVerifyActive ? "text-green-600" : "text-gray-400"}`} />
        )}
        <span className={`text-[10px] leading-none ${isVerifyActive ? "font-semibold text-green-600" : "text-gray-400"}`}>
          Verify
        </span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/profile")}
        className="flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5"
      >
        <User className={`h-5 w-5 ${isProfileActive ? "text-green-600" : "text-gray-400"}`} />
        <span className={`text-[10px] leading-none ${isProfileActive ? "font-semibold text-green-600" : "text-gray-400"}`}>
          Profile
        </span>
      </button>
    </div>
  );
}
