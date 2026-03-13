"use client";

import { AnimatePresence, motion } from "framer-motion";
import type {
  OrganizationType,
  ProjectDraft,
} from "@/types/verify-project";

interface Form3SellerInfoProps {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) => void;
}

const ORGANIZATION_OPTIONS: Array<{ value: OrganizationType; label: string }> = [
  { value: "private_public_company", label: "Private / Public Company" },
  { value: "ngo", label: "NGO" },
  { value: "individual", label: "Individual" },
  { value: "government", label: "Government" },
  { value: "other", label: "Other" },
];

export default function Form3SellerInfo({
  draft,
  errors,
  onFieldChange,
}: Form3SellerInfoProps) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="organization_name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Organization Name
          </label>
          <input
            id="organization_name"
            value={draft.organization_name}
            onChange={(event) =>
              onFieldChange("organization_name", event.target.value)
            }
            maxLength={200}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.organization_name ? (
            <p className="mt-1 text-xs text-red-500">{errors.organization_name}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="organization_type"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Organization Type
          </label>
          <select
            id="organization_type"
            value={draft.organization_type}
            onChange={(event) =>
              onFieldChange(
                "organization_type",
                event.target.value as ProjectDraft["organization_type"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select organization type</option>
            {ORGANIZATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.organization_type ? (
            <p className="mt-1 text-xs text-red-500">{errors.organization_type}</p>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {draft.organization_type === "other" ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <label
                htmlFor="organization_type_other"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Please specify your organization type
              </label>
              <input
                id="organization_type_other"
                value={draft.organization_type_other}
                onChange={(event) =>
                  onFieldChange("organization_type_other", event.target.value)
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.organization_type_other ? (
                <p className="mt-1 text-xs text-red-500">
                  {errors.organization_type_other}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div>
          <label
            htmlFor="seller_name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Your Full Name
          </label>
          <input
            id="seller_name"
            value={draft.seller_name}
            onChange={(event) => onFieldChange("seller_name", event.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.seller_name ? (
            <p className="mt-1 text-xs text-red-500">{errors.seller_name}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="seller_email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Your Email Address
          </label>
          <input
            id="seller_email"
            type="email"
            value={draft.seller_email}
            onChange={(event) =>
              onFieldChange("seller_email", event.target.value)
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.seller_email ? (
            <p className="mt-1 text-xs text-red-500">{errors.seller_email}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
