"use client";

import dynamic from "next/dynamic";

interface ProjectProofMapLoaderProps {
  projectType: string | null;
  latitude: number | null;
  longitude: number | null;
  polygonGeojson: object | null;
}

const ProjectProofMap = dynamic(() => import("@/components/projects/ProjectProofMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center bg-gray-50 text-sm text-gray-500">
      Loading snapshot...
    </div>
  ),
});

export default function ProjectProofMapLoader(props: ProjectProofMapLoaderProps) {
  return <ProjectProofMap {...props} />;
}
