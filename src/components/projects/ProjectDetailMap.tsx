"use client";

import { useEffect, useMemo, useRef } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";

interface ProjectDetailMapProps {
  projectType: string | null;
  latitude: number | null;
  longitude: number | null;
  polygonGeojson: object | null;
}

function parsePolygonPath(geojson: object | null): google.maps.LatLngLiteral[] {
  if (!geojson) return [];

  const feature = geojson as {
    geometry?: {
      type?: string;
      coordinates?: number[][][];
    };
  };

  if (feature.geometry?.type !== "Polygon") return [];
  const ring = feature.geometry.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 3) return [];

  return ring
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const lng = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    })
    .filter((point): point is google.maps.LatLngLiteral => Boolean(point));
}

function PolygonOverlay({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    if (path.length < 3) return;

    const polygon = new google.maps.Polygon({
      paths: path,
      fillColor: "#16a34a",
      fillOpacity: 0.25,
      strokeColor: "#16a34a",
      strokeWeight: 2,
      editable: false,
      clickable: false,
      map,
    });

    polygonRef.current = polygon;

    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 40);

    return () => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    };
  }, [map, path]);

  return null;
}

export default function ProjectDetailMap({
  projectType,
  latitude,
  longitude,
  polygonGeojson,
}: ProjectDetailMapProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const polygonPath = useMemo(() => parsePolygonPath(polygonGeojson), [polygonGeojson]);
  const isPolygonProject =
    projectType === "forestry" ||
    projectType === "agricultural" ||
    projectType === "solar";

  const center =
    latitude !== null && longitude !== null
      ? { lat: latitude, lng: longitude }
      : polygonPath[0] ?? { lat: 20.5937, lng: 78.9629 };

  if (!mapsApiKey) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
        Map configuration error.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <APIProvider apiKey={mapsApiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={isPolygonProject ? 12 : 14}
          mapTypeId="hybrid"
          gestureHandling="none"
          disableDefaultUI
          keyboardShortcuts={false}
          clickableIcons={false}
          style={{ width: "100%", height: "320px" }}
        >
          {isPolygonProject ? <PolygonOverlay path={polygonPath} /> : null}
          {!isPolygonProject && latitude !== null && longitude !== null ? (
            <Marker position={{ lat: latitude, lng: longitude }} />
          ) : null}
        </Map>
      </APIProvider>
    </div>
  );
}

