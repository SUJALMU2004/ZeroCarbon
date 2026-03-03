"use client";

import Link from "next/link";
import type { VerificationBannerModel } from "@/lib/dashboard/verification-banner";

type VerificationBannerProps = {
  model: VerificationBannerModel;
};

export function VerificationBanner({ model }: VerificationBannerProps) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-amber-900 shadow-[0_12px_24px_rgba(146,64,14,0.12)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M10 3.75 2.75 16.25h14.5L10 3.75Z" />
          <path d="M10 8v3.5M10 14.25h.01" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium">{model.message}</p>
      </div>

      {model.ctaLabel && model.ctaHref ? (
        <Link
          href={model.ctaHref}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition-colors duration-200 hover:bg-amber-100 sm:self-auto"
        >
          <span>{model.ctaLabel}</span>
          <span aria-hidden="true">{`\u2192`}</span>
        </Link>
      ) : null}
    </div>
  );
}

