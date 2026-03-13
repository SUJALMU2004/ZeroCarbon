"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SPECIES_LIST } from "@/lib/data/species";
import type { ProjectDraft } from "@/types/verify-project";

interface Form5LandDetailsProps {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) => void;
}

export default function Form5LandDetails({
  draft,
  errors,
  onFieldChange,
}: Form5LandDetailsProps) {
  const [search, setSearch] = useState("");

  const filteredSpecies = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return SPECIES_LIST;
    return SPECIES_LIST.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.localName.toLowerCase().includes(term),
    );
  }, [search]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Species Planted
          </label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search species..."
            className="mb-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="max-h-48 overflow-auto rounded-xl border border-gray-200">
            {filteredSpecies.map((species) => {
              const checked = draft.species.includes(species.value);
              return (
                <label
                  key={species.value}
                  className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm text-gray-700 last:border-b-0 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onFieldChange("species", [...draft.species, species.value]);
                      } else {
                        onFieldChange(
                          "species",
                          draft.species.filter((item) => item !== species.value),
                        );
                      }
                    }}
                    className="h-4 w-4 accent-green-600"
                  />
                  <span>
                    {species.label} - {species.localName}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {draft.species.length} selected
            </span>
            {errors.species ? (
              <span className="text-xs text-red-500">{errors.species}</span>
            ) : null}
          </div>
          {draft.species.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.species.map((species) => {
                const speciesLabel =
                  SPECIES_LIST.find((item) => item.value === species)?.label ??
                  species;
                return (
                  <span
                    key={species}
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"
                  >
                    {speciesLabel}
                    <button
                      type="button"
                      onClick={() =>
                        onFieldChange(
                          "species",
                          draft.species.filter((item) => item !== species),
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="number_of_trees"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Total Number of Trees / Plants
          </label>
          <input
            id="number_of_trees"
            type="number"
            min={1}
            value={draft.number_of_trees}
            onChange={(event) =>
              onFieldChange("number_of_trees", event.target.value)
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.number_of_trees ? (
            <p className="mt-1 text-xs text-red-500">{errors.number_of_trees}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="planting_year"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Year of Planting
            </label>
            <input
              id="planting_year"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={draft.planting_year}
              onChange={(event) =>
                onFieldChange("planting_year", event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.planting_year ? (
              <p className="mt-1 text-xs text-red-500">{errors.planting_year}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="plantation_density"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Plantation Density (trees per hectare, approximate)
            </label>
            <input
              id="plantation_density"
              type="number"
              value={draft.plantation_density}
              onChange={(event) =>
                onFieldChange("plantation_density", event.target.value)
              }
              placeholder="e.g. 1000"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.plantation_density ? (
              <p className="mt-1 text-xs text-red-500">
                {errors.plantation_density}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
