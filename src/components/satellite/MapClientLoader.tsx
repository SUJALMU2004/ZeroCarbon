"use client";

import dynamic from "next/dynamic";
import type { ProjectSatelliteData } from "@/types/satellite";

const GoogleMapClient = dynamic(() => import("@/components/satellite/GoogleMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[400px] w-full items-center justify-center rounded-2xl bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Loading satellite map...</p>
      </div>
    </div>
  ),
});

interface MapClientLoaderProps {
  projects: ProjectSatelliteData[];
}

export default function MapClientLoader({ projects }: MapClientLoaderProps) {
  return <GoogleMapClient projects={projects} />;
}
