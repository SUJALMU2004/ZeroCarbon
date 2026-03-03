"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFallbackBannerModel, getVerificationBannerModel, normalizeVerificationState } from "@/lib/dashboard/verification-banner";
import { VerificationBanner } from "@/components/dashboard/verification-banner";
import type { DashboardApiResponse } from "@/types/dashboard";

type DashboardContentState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      data: DashboardApiResponse;
    };

export function DashboardContent() {
  const router = useRouter();
  const [state, setState] = useState<DashboardContentState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          if (!isMounted) return;
          setState({
            status: "error",
            message: "Unable to load dashboard data right now.",
          });
          return;
        }

        const body = (await response.json()) as DashboardApiResponse;
        const normalizedVerification = normalizeVerificationState(body.verification_state);
        const isVerified =
          normalizedVerification.phone_verified &&
          normalizedVerification.identity_status === "verified";

        if (!isMounted) return;
        setState({
          status: "ready",
          data: {
            ...body,
            is_verified: isVerified,
            verification_state: normalizedVerification,
          },
        });
      } catch {
        if (!isMounted) return;
        setState({
          status: "error",
          message: "Unable to load dashboard data right now.",
        });
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router]);

  if (state.status === "loading") {
    return (
      <div className="mt-6 space-y-3">
        <div className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
      </div>
    );
  }

  if (state.status === "error") {
    const fallbackBanner = getFallbackBannerModel();
    return (
      <>
        <div className="mt-6 sticky top-24 z-30 sm:top-28">
          <div className="w-full max-w-3xl">
            <VerificationBanner model={fallbackBanner} />
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </div>
      </>
    );
  }

  const bannerModel = getVerificationBannerModel({
    isVerified: state.data.is_verified,
    verificationState: state.data.verification_state,
  });

  return (
    <>
      {bannerModel ? (
        <div className="mt-6 sticky top-24 z-30 sm:top-28">
          <div className="w-full max-w-3xl">
            <VerificationBanner model={bannerModel} />
          </div>
        </div>
      ) : null}
      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</p>
          <p className="mt-1 text-slate-900">{state.data.dashboard.email}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Role</p>
          <p className="mt-1 text-slate-900">{state.data.dashboard.role}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Created At</p>
          <p className="mt-1 text-slate-900">{state.data.dashboard.created_at}</p>
        </div>
      </div>
    </>
  );
}
