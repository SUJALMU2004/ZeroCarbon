"use client";

import type { ProjectDraft, ProjectType } from "@/types/verify-project";

interface Form1ProjectInfoProps {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) => void;
}

function getDurationText(startDate: string) {
  if (!startDate) return "";
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";

  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  if (months < 1) return "Started this month";

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `Running for ${years} years ${remMonths} months`;
}

const PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType; label: string }> = [
  { value: "forestry", label: "Forestry" },
  { value: "agricultural", label: "Agricultural" },
  { value: "solar", label: "Solar Energy" },
  { value: "methane", label: "Methane Capture" },
  { value: "windmill", label: "Wind Energy" },
];

export default function Form1ProjectInfo({
  draft,
  errors,
  onFieldChange,
}: Form1ProjectInfoProps) {
  const today = new Date().toISOString().split("T")[0];
  const duration = getDurationText(draft.start_date);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="project_title"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Project Title
          </label>
          <input
            id="project_title"
            value={draft.project_title}
            onChange={(event) =>
              onFieldChange("project_title", event.target.value)
            }
            placeholder="e.g. Silent Valley Reforestation"
            maxLength={200}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.project_title ? (
            <p className="mt-1 text-xs text-red-500">{errors.project_title}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="project_type"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Project Type
          </label>
          <select
            id="project_type"
            value={draft.project_type}
            onChange={(event) =>
              onFieldChange("project_type", event.target.value as ProjectType)
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select project type</option>
            {PROJECT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.project_type ? (
            <p className="mt-1 text-xs text-red-500">{errors.project_type}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="short_description"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Short Description
          </label>
          <textarea
            id="short_description"
            rows={4}
            value={draft.short_description}
            onChange={(event) =>
              onFieldChange("short_description", event.target.value)
            }
            maxLength={500}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.short_description ? (
              <p className="text-xs text-red-500">{errors.short_description}</p>
            ) : (
              <span />
            )}
            <p className="text-xs text-gray-400">
              {draft.short_description.length}/500
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="start_date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Start Date
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="start_date"
              type="date"
              value={draft.start_date}
              onChange={(event) => onFieldChange("start_date", event.target.value)}
              max={today}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {duration ? (
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                {duration}
              </span>
            ) : null}
          </div>
          {errors.start_date ? (
            <p className="mt-1 text-xs text-red-500">{errors.start_date}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
