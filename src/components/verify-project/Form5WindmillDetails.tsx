"use client";

import type {
  ProjectDraft,
  WindmillPowerOfftakerType,
  WindmillTurbineModel,
} from "@/types/verify-project";

interface Form5WindmillDetailsProps {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) => void;
}

const TURBINE_MODEL_OPTIONS: Array<{ value: WindmillTurbineModel; label: string }> = [
  { value: "suzlon_s120_2_1_mw", label: "Suzlon S120 (2.1 MW)" },
  { value: "vestas_v110_2_0_mw", label: "Vestas V110 (2.0 MW)" },
  { value: "ge_1_5_sle_1_5_mw", label: "GE 1.5-sle (1.5 MW)" },
  {
    value: "siemens_gamesa_sg_2_1_114_2_1_mw",
    label: "Siemens Gamesa SG 2.1-114 (2.1 MW)",
  },
  { value: "envision_en_131_2_5_mw", label: "Envision EN-131 (2.5 MW)" },
];

const POWER_OFFTAKER_OPTIONS: Array<{
  value: WindmillPowerOfftakerType;
  label: string;
}> = [
  {
    value: "exported_to_state_grid",
    label: "Exported to State Grid",
  },
  {
    value: "captive_consumption_industrial_facility",
    label: "Captive Consumption for Industrial Facility",
  },
];

export default function Form5WindmillDetails({
  draft,
  errors,
  onFieldChange,
}: Form5WindmillDetailsProps) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="windmill_turbine_model"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Installed Turbine Model
          </label>
          <select
            id="windmill_turbine_model"
            value={draft.windmill_turbine_model ?? ""}
            onChange={(event) =>
              onFieldChange(
                "windmill_turbine_model",
                event.target.value as ProjectDraft["windmill_turbine_model"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select installed turbine model</option>
            {TURBINE_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.windmill_turbine_model ? (
            <p className="mt-1 text-xs text-red-500">{errors.windmill_turbine_model}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="windmill_hub_height_m"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Tower Hub Height (meters)
          </label>
          <input
            id="windmill_hub_height_m"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draft.windmill_hub_height_m ?? ""}
            onChange={(event) =>
              onFieldChange("windmill_hub_height_m", event.target.value)
            }
            placeholder="Enter hub height in meters"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.windmill_hub_height_m ? (
            <p className="mt-1 text-xs text-red-500">{errors.windmill_hub_height_m}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="windmill_claimed_net_export_mwh"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Claimed Net Export (MWh)
          </label>
          <input
            id="windmill_claimed_net_export_mwh"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draft.windmill_claimed_net_export_mwh ?? ""}
            onChange={(event) =>
              onFieldChange("windmill_claimed_net_export_mwh", event.target.value)
            }
            placeholder="Enter metered electricity export"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.windmill_claimed_net_export_mwh ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.windmill_claimed_net_export_mwh}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="windmill_power_offtaker_type"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Power Offtaker Type
          </label>
          <select
            id="windmill_power_offtaker_type"
            value={draft.windmill_power_offtaker_type ?? ""}
            onChange={(event) =>
              onFieldChange(
                "windmill_power_offtaker_type",
                event.target.value as ProjectDraft["windmill_power_offtaker_type"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select power offtaker type</option>
            {POWER_OFFTAKER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.windmill_power_offtaker_type ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.windmill_power_offtaker_type}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
