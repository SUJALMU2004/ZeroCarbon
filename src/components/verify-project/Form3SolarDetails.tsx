"use client";

import { INDIA_STATES_AND_UTS } from "@/lib/data/india-states";
import type { PanelTechnology, ProjectDraft } from "@/types/verify-project";

interface Form3SolarDetailsProps {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) => void;
}

const PANEL_TECHNOLOGY_OPTIONS: Array<{ value: PanelTechnology; label: string }> = [
  { value: "monocrystalline", label: "Monocrystalline" },
  { value: "polycrystalline", label: "Polycrystalline" },
  { value: "thin_film", label: "Thin-Film" },
  { value: "bifacial", label: "Bifacial" },
];

export default function Form3SolarDetails({
  draft,
  errors,
  onFieldChange,
}: Form3SolarDetailsProps) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="claimed_capacity_mw"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Claimed Capacity (Megawatts)
          </label>
          <input
            id="claimed_capacity_mw"
            type="number"
            min="0"
            step="0.01"
            value={draft.claimed_capacity_mw}
            onChange={(event) =>
              onFieldChange("claimed_capacity_mw", event.target.value)
            }
            placeholder="e.g. 2.5"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.claimed_capacity_mw ? (
            <p className="mt-1 text-xs text-red-500">{errors.claimed_capacity_mw}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="panel_technology"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Panel Technology
          </label>
          <select
            id="panel_technology"
            value={draft.panel_technology}
            onChange={(event) =>
              onFieldChange(
                "panel_technology",
                event.target.value as ProjectDraft["panel_technology"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select panel technology</option>
            {PANEL_TECHNOLOGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.panel_technology ? (
            <p className="mt-1 text-xs text-red-500">{errors.panel_technology}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="grid_region"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Grid Region
          </label>
          <select
            id="grid_region"
            value={draft.grid_region}
            onChange={(event) => onFieldChange("grid_region", event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select grid region</option>
            {INDIA_STATES_AND_UTS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          {errors.grid_region ? (
            <p className="mt-1 text-xs text-red-500">{errors.grid_region}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
