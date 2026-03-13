"use client";

import Link from "next/link";
import Image from "next/image";

interface MarketplaceProjectCardProps {
  projectId: string;
  projectImageUrls: string[];
  referenceId: string;
  title: string;
  pricePerCreditInr: number | null;
  satelliteNdviCurrent: number | null;
  description: string;
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Pending";
  }

  return `INR ${value.toLocaleString()}`;
}

function formatNdvi(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Pending";
  }

  return value.toFixed(3);
}

function getNdviBadgeMeta(value: number | null): { label: string; className: string } {
  if (value === null || !Number.isFinite(value)) {
    return {
      label: "Pending",
      className: "border-gray-200 bg-gray-100 text-gray-600",
    };
  }

  if (value >= 0.6) {
    return {
      label: "High",
      className: "border-emerald-200 bg-emerald-100 text-emerald-700",
    };
  }

  if (value >= 0.4) {
    return {
      label: "Medium",
      className: "border-amber-200 bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Low",
    className: "border-rose-200 bg-rose-100 text-rose-700",
  };
}

export default function MarketplaceProjectCard({
  projectId,
  projectImageUrls,
  referenceId,
  title,
  pricePerCreditInr,
  satelliteNdviCurrent,
  description,
}: MarketplaceProjectCardProps) {
  const ndviBadge = getNdviBadgeMeta(satelliteNdviCurrent);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-linear-to-br from-white via-slate-50 to-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
      <div className="grid grid-cols-2 gap-2 p-3">
        {[0, 1].map((index) => {
          const imageUrl = projectImageUrls[index] ?? null;

          return (
            <div
              key={`${referenceId}-image-${index}`}
              className="relative h-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={`${title} preview ${index + 1}`}
                  fill
                  sizes="(max-width: 768px) 45vw, 180px"
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] font-medium tracking-wide text-gray-400">
                  NO IMAGE
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative z-10 space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
            {referenceId}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Live
          </span>
        </div>

        <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-slate-900">{title}</h3>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-2.5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Single Credit Cost
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">{formatPrice(pricePerCreditInr)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                Satellite Verified NDVI
              </p>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ndviBadge.className}`}
              >
                {ndviBadge.label}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatNdvi(satelliteNdviCurrent)}</p>
          </div>
        </div>

        <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{description}</p>

        <Link
          href={`/projects/${projectId}`}
          className="inline-flex w-full items-center justify-center rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:border-green-300 hover:bg-green-100"
        >
          View Project
        </Link>
      </div>
    </article>
  );
}
