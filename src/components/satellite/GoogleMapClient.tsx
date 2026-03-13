"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { useMapHeight } from "@/hooks/useMapHeight";
import ProjectInfoCard from "@/components/satellite/ProjectInfoCard";
import type { ProjectSatelliteData, ProjectType } from "@/types/satellite";

interface GoogleMapClientProps {
  projects: ProjectSatelliteData[];
}

type FilterType = "all" | ProjectType;

type ProjectTypeConfig = {
  label: string;
  iconPath: string;
  color: string;
};

const PROJECT_TYPE_CONFIG: Record<ProjectType, ProjectTypeConfig> = {
  forestry: {
    label: "Forestry",
    iconPath: "/icons/map-types/forestry.svg",
    color: "#16a34a",
  },
  agricultural: {
    label: "Agriculture",
    iconPath: "/icons/map-types/agricultural.svg",
    color: "#d97706",
  },
  solar: {
    label: "Solar Farm",
    iconPath: "/icons/map-types/solar-farm.svg",
    color: "#ca8a04",
  },
  methane: {
    label: "Methane Capture",
    iconPath: "/icons/map-types/methane-capture.svg",
    color: "#2563eb",
  },
  windmill: {
    label: "Wind Mills",
    iconPath: "/icons/map-types/wind-mills.svg",
    color: "#0e7490",
  },
};

const FILTER_OPTIONS: Array<{ key: FilterType; label: string }> = [
  { key: "all", label: "All" },
  { key: "forestry", label: PROJECT_TYPE_CONFIG.forestry.label },
  { key: "agricultural", label: PROJECT_TYPE_CONFIG.agricultural.label },
  { key: "solar", label: PROJECT_TYPE_CONFIG.solar.label },
  { key: "methane", label: PROJECT_TYPE_CONFIG.methane.label },
  { key: "windmill", label: PROJECT_TYPE_CONFIG.windmill.label },
];

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

function IconFallback({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: color,
        color: "white",
        fontSize: 10,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {label.charAt(0)}
    </span>
  );
}

function TypeIcon({
  type,
  size = 18,
}: {
  type: ProjectType;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const config = PROJECT_TYPE_CONFIG[type];

  if (failed) {
    return <IconFallback color={config.color} label={config.label} />;
  }

  return (
    <Image
      src={config.iconPath}
      alt={config.label}
      width={size}
      height={size}
      unoptimized
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
      onError={() => setFailed(true)}
    />
  );
}

export default function GoogleMapClient({ projects }: GoogleMapClientProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { height, isReady } = useMapHeight();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedProject, setSelectedProject] = useState<ProjectSatelliteData | null>(null);
  const [infoWindowPosition, setInfoWindowPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [canHover, setCanHover] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mediaQuery.matches);
    update();

    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const filteredProjects = useMemo(() => {
    if (activeFilter === "all") return projects;
    return projects.filter((project) => project.project_type === activeFilter);
  }, [activeFilter, projects]);

  const selectedProjectVisible = useMemo(() => {
    if (!selectedProject) return null;
    return filteredProjects.some((project) => project.id === selectedProject.id)
      ? selectedProject
      : null;
  }, [filteredProjects, selectedProject]);

  const openProjectCard = useCallback(
    (project: ProjectSatelliteData) => {
      clearCloseTimer();
      setSelectedProject(project);
      setInfoWindowPosition({ lat: project.latitude, lng: project.longitude });
    },
    [clearCloseTimer],
  );

  const scheduleCloseCard = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setSelectedProject(null);
      setInfoWindowPosition(null);
    }, 160);
  }, [clearCloseTimer]);

  const hasProjects = filteredProjects.length > 0;

  const mapProjectCountLabel = useMemo(() => {
    if (activeFilter === "all") {
      return `${projects.length} verified project${projects.length !== 1 ? "s" : ""}`;
    }
    return `${filteredProjects.length} ${PROJECT_TYPE_CONFIG[activeFilter].label.toLowerCase()} project${
      filteredProjects.length !== 1 ? "s" : ""
    }`;
  }, [activeFilter, filteredProjects.length, projects.length]);

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
        @keyframes markerPulse {
          0%, 100% { transform: scale(0.95); opacity: 0.55; }
          50% { transform: scale(1.15); opacity: 0.2; }
        }
      `}</style>

      <div className="absolute left-0 right-0 top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Satellite Verified Projects</h1>
            <p className="text-xs text-gray-500">{mapProjectCountLabel}</p>
          </div>

          <Link
            href="/projects"
            className="text-xs text-gray-500 transition-colors hover:text-gray-900"
          >
            &larr; Back to Projects
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((option) => {
            const active = activeFilter === option.key;
            const optionType = option.key === "all" ? null : option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveFilter(option.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                {optionType ? <TypeIcon type={optionType} /> : null}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
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
          <FitBoundsOnLoad projects={filteredProjects} />

          {filteredProjects.map((project) => {
            const isProcessing = project.satellite_status === "processing";

            return (
              <AdvancedMarker
                key={project.id}
                position={{ lat: project.latitude, lng: project.longitude }}
                onClick={() => openProjectCard(project)}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openProjectCard(project)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openProjectCard(project);
                    }
                  }}
                  onMouseEnter={() => {
                    if (canHover) openProjectCard(project);
                  }}
                  onMouseLeave={() => {
                    if (canHover) scheduleCloseCard();
                  }}
                  onFocus={() => openProjectCard(project)}
                  style={{
                    width: 44,
                    height: 44,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  {isProcessing ? (
                    <span
                      style={{
                        position: "absolute",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: PROJECT_TYPE_CONFIG[project.project_type].color,
                        animation: "markerPulse 1.4s ease-in-out infinite",
                      }}
                    />
                  ) : null}

                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      border: "2px solid #ffffff",
                      boxShadow: "0 3px 10px rgba(0, 0, 0, 0.25)",
                      background: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TypeIcon type={project.project_type} size={19} />
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

          {selectedProjectVisible && infoWindowPosition ? (
            <InfoWindow
              position={infoWindowPosition}
              onCloseClick={() => {
                setSelectedProject(null);
                setInfoWindowPosition(null);
              }}
              pixelOffset={[0, -24]}
            >
              <ProjectInfoCard
                project={selectedProjectVisible}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={() => {
                  if (canHover) scheduleCloseCard();
                }}
              />
            </InfoWindow>
          ) : null}
        </Map>
      </APIProvider>

      {!hasProjects ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-2xl bg-white/90 px-8 py-6 text-center shadow-lg backdrop-blur-sm">
            <p className="text-sm font-medium text-gray-700">No matching verified projects</p>
            <p className="mt-1 text-xs text-gray-400">Try a different project type filter</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
