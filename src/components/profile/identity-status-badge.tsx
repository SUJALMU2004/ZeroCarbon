import type { JSX } from "react";

type VerificationStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required";

type IdentityStatusBadgeProps = {
  status: VerificationStatus;
};

const STATUS_MAP: Record<
  VerificationStatus,
  {
    label: string;
    className: string;
    icon: JSX.Element;
  }
> = {
  not_submitted: {
    label: "Not Submitted",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 4v12M4 10h12" strokeLinecap="round" />
      </svg>
    ),
  },
  pending: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 5v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="7" />
      </svg>
    ),
  },
  verified: {
    label: "Verified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m6 6 8 8m0-8-8 8" strokeLinecap="round" />
      </svg>
    ),
  },
  resubmit_required: {
    label: "Resubmit Required",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 10a6 6 0 0 1 10.24-4.24M16 10a6 6 0 0 1-10.24 4.24" strokeLinecap="round" />
        <path d="M11 3h3v3M9 17H6v-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

export function IdentityStatusBadge({ status }: IdentityStatusBadgeProps) {
  const meta = STATUS_MAP[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${meta.className}`}
      aria-label={`Identity verification status: ${meta.label}`}
    >
      {meta.icon}
      <span>{meta.label}</span>
    </div>
  );
}
