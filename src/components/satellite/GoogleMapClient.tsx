"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { useMapHeight } from "@/hooks/useMapHeight";
import ProjectInfoCard from "@/components/satellite/ProjectInfoCard";
import type { ProjectSatelliteData } from "@/types/satellite";

interface GoogleMapClientProps {
  projects: ProjectSatelliteData[];
}

function getMarkerColor(projectType: string): string {
  switch (projectType) {
    case "forestry":
      return "#16a34a";
    case "solar":
      return "#facc15";
    case "methane":
      return "#3b82f6";
    default:
      return "#9ca3af";
  }
}

function FitBoundsOnLoad({ projects }: { projects: ProjectSatelliteData[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || projects.length === 0 || typeof google === "undefined") {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    projects.forEach((project) => {
      bounds.extend({ lat: project.latitude, lng: project.longitude });
    });

    map.fitBounds(bounds, 80);

    const listener = google.maps.event.addListener(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 12) {
        map.setZoom(12);
      }
      google.maps.event.removeListener(listener);
    });
  }, [map, projects]);

  return null;
}

export default function GoogleMapClient({ projects }: GoogleMapClientProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { height, isReady } = useMapHeight();
  const [selectedProject, setSelectedProject] = useState<ProjectSatelliteData | null>(null);
  const [infoWindowPosition, setInfoWindowPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const hasProjects = projects.length > 0;

  const mapProjectCountLabel = useMemo(() => {
    return `${projects.length} verified project${projects.length !== 1 ? "s" : ""}`;
  }, [projects.length]);

  if (!mapsApiKey) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-2xl bg-gray-50"
        style={{ height: 400 }}
      >
        <p className="text-sm text-gray-600">Map configuration error.</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex w-full items-center justify-center bg-gray-50" style={{ height: 400 }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }} className="relative w-full">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1) rotate(-45deg); }
          50% { opacity: 0.5; transform: scale(1.15) rotate(-45deg); }
        }
      `}</style>

      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-3 backdrop-blur-sm">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Satellite Verified Projects</h1>
          <p className="text-xs text-gray-500">{mapProjectCountLabel}</p>
        </div>

        <div className="hidden items-center gap-4 text-xs text-gray-500 lg:flex">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" />
            Forestry
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" />
            Solar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            Methane
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
            Other
          </span>
        </div>

        <Link href="/projects" className="text-xs text-gray-500 transition-colors hover:text-gray-900">
          ← Back to Projects
        </Link>
      </div>

      <APIProvider apiKey={mapsApiKey}>
        <Map
          mapId="zerocarbon-satellite-map"
          defaultCenter={{ lat: 20, lng: 0 }}
          defaultZoom={2}
          mapTypeId="hybrid"
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: "100%", height: "100%" }}
        >
          <FitBoundsOnLoad projects={projects} />

          {projects.map((project) => (
            <AdvancedMarker
              key={project.id}
              position={{ lat: project.latitude, lng: project.longitude }}
              onClick={() => {
                setSelectedProject(project);
                setInfoWindowPosition({ lat: project.latitude, lng: project.longitude });
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50% 50% 50% 0",
                  transform: "rotate(-45deg)",
                  background: getMarkerColor(project.project_type),
                  border: "3px solid white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  cursor: "pointer",
                  animation: project.satellite_status === "processing" ? "pulse 1.5s infinite" : "none",
                }}
              />
            </AdvancedMarker>
          ))}

          {selectedProject && infoWindowPosition ? (
            <InfoWindow
              position={infoWindowPosition}
              onCloseClick={() => {
                setSelectedProject(null);
                setInfoWindowPosition(null);
              }}
              pixelOffset={[0, -30]}
            >
              <ProjectInfoCard project={selectedProject} />
            </InfoWindow>
          ) : null}
        </Map>
      </APIProvider>

      {!hasProjects ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-2xl bg-white/90 px-8 py-6 text-center shadow-lg backdrop-blur-sm">
            <p className="text-sm font-medium text-gray-700">No verified projects yet</p>
            <p className="mt-1 text-xs text-gray-400">Projects appear here once approved</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
