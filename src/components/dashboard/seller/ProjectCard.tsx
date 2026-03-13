"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Leaf,
  Sun,
  Flame,
  Wheat,
  Wind,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import { getProjectStatusMeta, type ProjectStatusValue } from "@/lib/utils/projectStatus";

interface ProjectCardProps {
  id: string;
  projectName: string;
  projectType: string | null;
  status: ProjectStatusValue;
  description: string;
  submittedAt: string | null;
}

function getProjectTypeMeta(type: string | null): { label: string; Icon: LucideIcon } {
  if (type === "forestry") {
    return { label: "Forestry", Icon: Leaf };
  }

  if (type === "agricultural") {
    return { label: "Agricultural", Icon: Wheat };
  }

  if (type === "solar") {
    return { label: "Solar", Icon: Sun };
  }

  if (type === "methane") {
    return { label: "Methane", Icon: Flame };
  }

  if (type === "windmill") {
    return { label: "Windmill", Icon: Wind };
  }

  return { label: "Other", Icon: Shapes };
}

function formatDate(value: string | null): string {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
}

export default function ProjectCard({
  id,
  projectName,
  projectType,
  status,
  description,
  submittedAt,
}: ProjectCardProps) {
  const statusMeta = getProjectStatusMeta(status);
  const typeMeta = getProjectTypeMeta(projectType);
  const TypeIcon = typeMeta.Icon;

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Link
        href={`/dashboard/seller/projects/${id}`}
        className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <TypeIcon className="h-3.5 w-3.5" />
            <span>{typeMeta.label}</span>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
        </div>

        <h3 className="mt-4 line-clamp-2 text-base font-semibold text-gray-900">{projectName}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-gray-600">{description || "No description"}</p>

        <div className="mt-5 flex items-center justify-between text-xs">
          <span className="text-gray-500">Submitted {formatDate(submittedAt)}</span>
          <span className="font-semibold text-green-700">View Details →</span>
        </div>
      </Link>
    </motion.div>
  );
}

