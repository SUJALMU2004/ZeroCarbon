"use client";

import { COUNTRIES } from "@/lib/data/countries";
import type { ProjectDraft } from "@/types/verify-project";
import MapPinDrop from "@/components/verify-project/MapPinDrop";
import MapPolygonDraw from "@/components/verify-project/MapPolygonDraw";

interface Form2LocationProps {
  draft: ProjectDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) => void;
}

export default function Form2Location({
  draft,
  errors,
  onFieldChange,
}: Form2LocationProps) {
  const isPolygonMode =
    draft.project_type === "forestry" ||
    draft.project_type === "agricultural" ||
    draft.project_type === "solar";
  const isSinglePinMode = draft.project_type === "methane";
  const isWindmillMultiPinMode = draft.project_type === "windmill";
  const windmillLocations = Array.isArray(draft.windmill_locations)
    ? draft.windmill_locations
    : [];

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="street_address"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Street Address
          </label>
          <input
            id="street_address"
            value={draft.street_address}
            onChange={(event) =>
              onFieldChange("street_address", event.target.value)
            }
            maxLength={300}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.street_address ? (
            <p className="mt-1 text-xs text-red-500">{errors.street_address}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="state"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              State / Province
            </label>
            <input
              id="state"
              value={draft.state}
              onChange={(event) => onFieldChange("state", event.target.value)}
              maxLength={100}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.state ? (
              <p className="mt-1 text-xs text-red-500">{errors.state}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="pin_code"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              PIN Code / Postal Code
            </label>
            <input
              id="pin_code"
              value={draft.pin_code}
              onChange={(event) => onFieldChange("pin_code", event.target.value)}
              maxLength={20}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.pin_code ? (
              <p className="mt-1 text-xs text-red-500">{errors.pin_code}</p>
            ) : null}
          </div>
        </div>

        <div>
          <label
            htmlFor="country"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Country
          </label>
          <select
            id="country"
            value={draft.country}
            onChange={(event) => onFieldChange("country", event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select country</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {errors.country ? (
            <p className="mt-1 text-xs text-red-500">{errors.country}</p>
          ) : null}
        </div>

        {isPolygonMode ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Draw Your Project Area
              </h3>
              <p className="text-sm text-gray-500">
                Draw a polygon on the map to mark your exact project boundary.
                This will be used for satellite NDVI verification.
              </p>
            </div>

            <MapPolygonDraw
              initialGeojson={draft.polygon_geojson}
              onPolygonChange={(geojson, hectares) => {
                onFieldChange("polygon_geojson", geojson as object | null);
                onFieldChange("land_area_hectares", hectares as number | null);
              }}
            />

            <div className="text-sm text-gray-700">
              {draft.land_area_hectares !== null ? (
                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-green-700">
                  Calculated Area: {draft.land_area_hectares.toFixed(2)} ha
                </span>
              ) : (
                "No polygon area calculated yet."
              )}
            </div>

            {errors.polygon_geojson ? (
              <p className="text-xs text-red-500">{errors.polygon_geojson}</p>
            ) : null}
          </div>
        ) : null}

        {isSinglePinMode ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Pin Your Project Location
              </h3>
              <p className="text-sm text-gray-500">
                Click on the map to mark the exact location of your project.
              </p>
            </div>

            <MapPinDrop
              key="single-pin-map"
              initialLat={draft.latitude}
              initialLng={draft.longitude}
              onLocationChange={(lat, lng) => {
                onFieldChange("latitude", lat);
                onFieldChange("longitude", lng);
              }}
            />

            {(errors.latitude || errors.longitude) && (
              <p className="text-xs text-red-500">
                {errors.latitude ?? errors.longitude}
              </p>
            )}
          </div>
        ) : null}

        {isWindmillMultiPinMode ? (
          <div className="space-y-3" id="windmill_locations">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Pin Windmill Locations
              </h3>
              <p className="text-sm text-gray-500">
                Click to add each turbine location. Click an existing marker to
                remove it. At least one location is required.
              </p>
            </div>

            <MapPinDrop
              key="windmill-multi-pin-map"
              mode="multiple"
              initialPoints={windmillLocations.map((location) => ({
                lat: location.latitude,
                lng: location.longitude,
              }))}
              onLocationsChange={(locations) => {
                const nextLocations = locations.map((location) => ({
                  latitude: location.lat,
                  longitude: location.lng,
                }));
                queueMicrotask(() => {
                  onFieldChange("windmill_locations", nextLocations);

                  if (nextLocations.length < 1) {
                    onFieldChange("latitude", null);
                    onFieldChange("longitude", null);
                    return;
                  }

                  const totals = nextLocations.reduce(
                    (accumulator, location) => ({
                      latitude: accumulator.latitude + location.latitude,
                      longitude: accumulator.longitude + location.longitude,
                    }),
                    { latitude: 0, longitude: 0 },
                  );
                  onFieldChange(
                    "latitude",
                    totals.latitude / nextLocations.length,
                  );
                  onFieldChange(
                    "longitude",
                    totals.longitude / nextLocations.length,
                  );
                });
              }}
            />

            <div className="text-sm text-gray-700">
              {windmillLocations.length > 0 ? (
                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-green-700">
                  {windmillLocations.length} location point(s) selected
                </span>
              ) : (
                "No windmill locations selected yet."
              )}
            </div>

            {(errors.windmill_locations || errors.latitude || errors.longitude) && (
              <p className="text-xs text-red-500">
                {errors.windmill_locations ?? errors.latitude ?? errors.longitude}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
