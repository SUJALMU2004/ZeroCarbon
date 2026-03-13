"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart2,
  BookOpen,
  Briefcase,
  Building2,
  ChevronRight,
  Clock,
  Flame,
  Globe2,
  LayoutDashboard,
} from "lucide-react";
import type { IdentityStatus } from "@/types/dashboard";

type DashboardSidebarProps = {
  phoneVerified: boolean;
  verificationStatus: IdentityStatus;
  userEmail: string;
  companyStatus: IdentityStatus;
  companyName: string | null;
};

type DashboardMode = "buyer" | "seller";

type NavItem = {
  label: string;
  href: string;
  placeholder?: boolean;
  icon: ComponentType<{ className?: string }>;
};

const buyerLinks: NavItem[] = [
  { label: "Overview", href: "/dashboard/buyer", icon: LayoutDashboard },
  { label: "Satellite Map", href: "/projects/map", icon: Globe2 },
  { label: "Emissions", href: "/dashboard/buyer/emissions", icon: Flame },
  { label: "Portfolio", href: "/dashboard/buyer/portfolio", icon: Briefcase, placeholder: true },
  { label: "Registry", href: "/dashboard/buyer/registry", icon: BookOpen, placeholder: true },
];

const sellerLinks: NavItem[] = [
  { label: "Overview", href: "/dashboard/seller", icon: LayoutDashboard },
  { label: "Satellite Map", href: "/projects/map", icon: Globe2 },
  { label: "Analytics", href: "/dashboard/seller/analytics", icon: BarChart2, placeholder: true },
  { label: "Registry", href: "/dashboard/seller/registry", icon: BookOpen, placeholder: true },
];

export function DashboardSidebar({
  phoneVerified,
  verificationStatus,
  userEmail,
  companyStatus,
  companyName,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeMode: DashboardMode = pathname?.includes("/seller") ? "seller" : "buyer";
  const isTransitioning = pendingRoute !== null && pendingRoute !== pathname;
  const links = useMemo(() => (activeMode === "seller" ? sellerLinks : buyerLinks), [activeMode]);
  const canShowVerifiedCompanyCard =
    companyStatus === "verified" &&
    phoneVerified &&
    verificationStatus === "verified";

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const triggerComingSoon = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setComingSoonVisible(true);
    timeoutRef.current = setTimeout(() => {
      setComingSoonVisible(false);
    }, 2000);
  };

  const handleModeChange = (nextMode: DashboardMode) => {
    if (isTransitioning) {
      return;
    }

    const targetRoute = nextMode === "buyer" ? "/dashboard/buyer" : "/dashboard/seller";
    if (pathname === targetRoute) {
      return;
    }

    setPendingRoute(targetRoute);
    router.push(targetRoute);
  };

  void userEmail;

  return (
    <motion.aside
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="sticky top-0 hidden h-screen w-[260px] flex-col border-r border-gray-100 bg-white md:flex"
    >
      <div className="px-4 pt-5">
        <div className="flex rounded-xl bg-gray-100 p-1">
          {(["buyer", "seller"] as const).map((mode) => {
            const isActive = activeMode === mode;

            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                disabled={isTransitioning}
                className={`relative flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {isActive ? (
                  <motion.span
                    layoutId="sidebar-mode-toggle"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center gap-2">
                  {isTransitioning && isActive ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-gray-300 border-t-gray-700" />
                  ) : null}
                  <span className="capitalize">{mode}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <nav className="mt-5 px-2">
        <div className="space-y-1">
          {links.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const sharedClassName = `mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-150 ${
              isActive
                ? "bg-green-50 font-semibold text-green-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`;

            if (item.placeholder) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={triggerComingSoon}
                  className={sharedClassName}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={sharedClassName}>
                <Icon className={`h-4 w-4 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <AnimatePresence>
          {comingSoonVisible ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="mx-4 mt-2 text-xs text-gray-500"
            >
              Coming soon
            </motion.p>
          ) : null}
        </AnimatePresence>
      </nav>

      <div className="mx-4 mt-4 border-t border-gray-100 pt-4">
        {activeMode === "buyer" ? (
          companyStatus === "pending" ? (
            <div className="cursor-not-allowed rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Under Review</span>
              </div>
              <p className="mt-1 text-xs text-amber-500">Company registration pending</p>
            </div>
          ) : canShowVerifiedCompanyCard ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              onClick={() => router.push("/dashboard/buyer/company")}
              className="flex w-full items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-left transition-colors hover:bg-green-100"
            >
              <Building2 className="h-4 w-4 text-green-600" />
              <div className="min-w-0">
                <p className="max-w-[140px] truncate text-sm font-semibold text-green-800">
                  {companyName || "Verified Company"}
                </p>
                <p className="text-xs text-green-600">Verified</p>
              </div>
              <ChevronRight className="ml-auto h-3 w-3 text-green-400" />
            </motion.button>
          ) : (
            <div>
              {companyStatus === "rejected" ? (
                <div className="mb-2 inline-flex items-center gap-2 text-xs text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Action Required</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => router.push("/verify-company")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-700"
              >
                <Building2 className="h-4 w-4" />
                <span>Register Your Company</span>
              </button>
            </div>
          )
        ) : null}
      </div>
    </motion.aside>
  );
}
