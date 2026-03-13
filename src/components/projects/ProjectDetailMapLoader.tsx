"use client";

import dynamic from "next/dynamic";

interface ProjectDetailMapLoaderProps {
  projectType: string | null;
  latitude: number | null;
  longitude: number | null;
  polygonGeojson: object | null;
}

const ProjectDetailMap = dynamic(() => import("@/components/projects/ProjectDetailMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
      Loading map...
    </div>
  ),
});

export default function ProjectDetailMapLoader(props: ProjectDetailMapLoaderProps) {
  return <ProjectDetailMap {...props} />;
}

