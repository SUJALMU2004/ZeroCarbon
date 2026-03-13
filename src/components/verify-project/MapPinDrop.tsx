"use client";

import { useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";

type Coordinate = { lat: number; lng: number };

interface MapPinDropProps {
  onLocationChange?: (lat: number, lng: number) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  mode?: "single" | "multiple";
  initialPoints?: Coordinate[];
  onLocationsChange?: (locations: Coordinate[]) => void;
}

export default function MapPinDrop({
  onLocationChange,
  initialLat = null,
  initialLng = null,
  mode = "single",
  initialPoints = [],
  onLocationsChange,
}: MapPinDropProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const isMultipleMode = mode === "multiple";
  const initialMarkers: Coordinate[] =
    isMultipleMode
      ? initialPoints.filter(
          (point) =>
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lng) &&
            point.lat >= -90 &&
            point.lat <= 90 &&
            point.lng >= -180 &&
            point.lng <= 180,
        )
      : initialLat !== null && initialLng !== null
        ? [{ lat: initialLat, lng: initialLng }]
        : [];

  const [markers, setMarkers] = useState<Coordinate[]>(initialMarkers);
  const [showInstruction, setShowInstruction] = useState(
    initialMarkers.length === 0,
  );
  const mapCenter = markers[0] ?? { lat: 20.5937, lng: 78.9629 };

  const notifySingleLocation = (nextMarkers: Coordinate[]) => {
    if (!onLocationChange) return;

    if (nextMarkers.length === 0) {
      return;
    }
    const first = nextMarkers[0];
    onLocationChange(first.lat, first.lng);
  };

  const handleMapClick = (event: MapMouseEvent) => {
    const latLng = event.detail.latLng;
    if (!latLng) return;

    if (isMultipleMode) {
      setMarkers((previous) => {
        const alreadyExists = previous.some(
          (marker) =>
            Math.abs(marker.lat - latLng.lat) < 0.000001 &&
            Math.abs(marker.lng - latLng.lng) < 0.000001,
        );
        if (alreadyExists) return previous;

        const next = [...previous, latLng];
        setShowInstruction(false);
        onLocationsChange?.(next);
        return next;
      });
      return;
    }

    const next = [latLng];
    setMarkers(next);
    setShowInstruction(false);
    notifySingleLocation(next);
  };

  const handleRemoveMarker = (index: number) => {
    if (!isMultipleMode) return;
    setMarkers((previous) => {
      const next = previous.filter((_, markerIndex) => markerIndex !== index);
      setShowInstruction(next.length === 0);
      onLocationsChange?.(next);
      return next;
    });
  };

  const handleClearAll = () => {
    if (!isMultipleMode) return;
    setMarkers([]);
    setShowInstruction(true);
    onLocationsChange?.([]);
  };

  if (!mapsApiKey) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Google Maps key is missing. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200">
      <APIProvider apiKey={mapsApiKey}>
        <Map
          mapTypeId="hybrid"
          defaultCenter={mapCenter}
          defaultZoom={5}
          gestureHandling="greedy"
          style={{ width: "100%", height: "400px" }}
          onClick={handleMapClick}
        >
          {markers.map((marker, index) => (
            <Marker
              key={`${marker.lat}-${marker.lng}-${index}`}
              position={marker}
              onClick={() => handleRemoveMarker(index)}
            />
          ))}
        </Map>
      </APIProvider>

      {showInstruction ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 rounded-xl bg-white/95 px-4 py-2 text-center text-sm text-gray-700 shadow">
          {isMultipleMode
            ? "Click map to add windmill locations. Click a marker to remove it."
            : "Click anywhere on the map to set your project location"}
        </div>
      ) : null}

      <div className="border-t border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
        {isMultipleMode ? (
          <div className="flex items-center justify-between gap-4">
            <span>{markers.length} location point(s) selected.</span>
            {markers.length > 0 ? (
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : markers.length > 0 ? (
          <>
            Lat: {markers[0].lat.toFixed(6)}, Lng: {markers[0].lng.toFixed(6)}
          </>
        ) : (
          "No location selected yet."
        )}
      </div>
    </div>
  );
}
