"use client";

import type {
  MethaneDestructionMethod,
  MethaneSourceType,
  ProjectDraft,
} from "@/types/verify-project";

interface Form5MethaneDetailsProps {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) => void;
}

const SOURCE_TYPE_OPTIONS: Array<{ value: MethaneSourceType; label: string }> = [
  {
    value: "municipal_solid_waste_landfill",
    label: "Municipal Solid Waste Landfill",
  },
  {
    value: "agricultural_anaerobic_digester",
    label: "Agricultural Anaerobic Digester",
  },
  {
    value: "coal_mine_gas",
    label: "Coal Mine Gas",
  },
  {
    value: "wastewater_treatment",
    label: "Wastewater Treatment",
  },
];

const DESTRUCTION_METHOD_OPTIONS: Array<{
  value: MethaneDestructionMethod;
  label: string;
}> = [
  { value: "open_flare", label: "Open Flare" },
  {
    value: "enclosed_high_temperature_flare",
    label: "Enclosed High-Temperature Flare",
  },
  {
    value: "internal_combustion_engine",
    label: "Internal Combustion Engine",
  },
  { value: "boiler", label: "Boiler" },
  { value: "bio_cng_vehicle_fuel", label: "Bio-CNG / Vehicle Fuel" },
  { value: "pipeline_injection", label: "Pipeline Injection" },
];

export default function Form5MethaneDetails({
  draft,
  errors,
  onFieldChange,
}: Form5MethaneDetailsProps) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="methane_source_type"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Source Type
          </label>
          <select
            id="methane_source_type"
            value={draft.methane_source_type}
            onChange={(event) =>
              onFieldChange(
                "methane_source_type",
                event.target.value as ProjectDraft["methane_source_type"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select source type</option>
            {SOURCE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.methane_source_type ? (
            <p className="mt-1 text-xs text-red-500">{errors.methane_source_type}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="methane_destruction_method"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Destruction Method
          </label>
          <select
            id="methane_destruction_method"
            value={draft.methane_destruction_method}
            onChange={(event) =>
              onFieldChange(
                "methane_destruction_method",
                event.target.value as ProjectDraft["methane_destruction_method"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select destruction method</option>
            {DESTRUCTION_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.methane_destruction_method ? (
            <p className="mt-1 text-xs text-red-500">{errors.methane_destruction_method}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="claimed_methane_volume_m3"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Claimed Methane Volume (m3)
          </label>
          <input
            id="claimed_methane_volume_m3"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draft.claimed_methane_volume_m3}
            onChange={(event) =>
              onFieldChange("claimed_methane_volume_m3", event.target.value)
            }
            placeholder="Enter claimed methane volume"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.claimed_methane_volume_m3 ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.claimed_methane_volume_m3}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="ch4_concentration"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            CH4 Concentration (fraction 0..1 or percent 0..100)
          </label>
          <input
            id="ch4_concentration"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draft.ch4_concentration}
            onChange={(event) => onFieldChange("ch4_concentration", event.target.value)}
            placeholder="Example: 0.52 or 52"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.ch4_concentration ? (
            <p className="mt-1 text-xs text-red-500">{errors.ch4_concentration}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="methane_generates_electricity"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Is this gas being used to generate electricity?
          </label>
          <select
            id="methane_generates_electricity"
            value={draft.methane_generates_electricity}
            onChange={(event) =>
              onFieldChange(
                "methane_generates_electricity",
                event.target.value as ProjectDraft["methane_generates_electricity"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select option</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          {errors.methane_generates_electricity ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.methane_generates_electricity}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
