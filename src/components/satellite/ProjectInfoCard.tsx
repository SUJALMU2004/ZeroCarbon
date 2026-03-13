"use client";

import type { CSSProperties, MouseEventHandler } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ProjectSatelliteData } from "@/types/satellite";

interface ProjectInfoCardProps {
  project: ProjectSatelliteData;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
}

function getProjectTypeLabel(projectType: ProjectSatelliteData["project_type"]): string {
  switch (projectType) {
    case "forestry":
      return "Forestry";
    case "agricultural":
      return "Agriculture";
    case "solar":
      return "Solar Farm";
    case "methane":
      return "Methane Capture";
    case "windmill":
      return "Wind Mills";
    default:
      return "Project";
  }
}

function getProjectTypeBadgeStyle(projectType: ProjectSatelliteData["project_type"]): CSSProperties {
  switch (projectType) {
    case "forestry":
      return { background: "#dcfce7", color: "#166534" };
    case "agricultural":
      return { background: "#fef3c7", color: "#92400e" };
    case "solar":
      return { background: "#fef9c3", color: "#854d0e" };
    case "methane":
      return { background: "#dbeafe", color: "#1e40af" };
    case "windmill":
      return { background: "#e0f2fe", color: "#0c4a6e" };
    default:
      return { background: "#f3f4f6", color: "#4b5563" };
  }
}

function formatConfidence(project: ProjectSatelliteData): string {
  if (project.satellite_confidence_score === null) return "Pending";
  const badge = project.satellite_confidence_badge ?? "Unknown";
  return `${badge} (${project.satellite_confidence_score}/100)`;
}

function formatNdvi(project: ProjectSatelliteData): string {
  if (project.satellite_ndvi_current === null) return "Pending";
  return project.satellite_ndvi_current.toFixed(3);
}

function formatPrice(project: ProjectSatelliteData): string {
  if (project.price_per_credit_inr === null) return "Pending";
  return `INR ${project.price_per_credit_inr.toLocaleString()}`;
}

export default function ProjectInfoCard({
  project,
  onMouseEnter,
  onMouseLeave,
}: ProjectInfoCardProps) {
  const badgeStyle = getProjectTypeBadgeStyle(project.project_type);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: 280,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          width: "100%",
          height: 136,
          position: "relative",
          borderRadius: 10,
          overflow: "hidden",
          background: "#f3f4f6",
          marginBottom: 10,
          border: "1px solid #e5e7eb",
        }}
      >
        {project.project_image_url ? (
          <Image
            src={project.project_image_url}
            alt={`${project.project_name} preview`}
            fill
            sizes="280px"
            style={{ objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            IMAGE PENDING
          </div>
        )}
      </div>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "3px 9px",
          borderRadius: 9999,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
          ...badgeStyle,
        }}
      >
        {getProjectTypeLabel(project.project_type)}
      </span>

      <h3
        style={{
          margin: 0,
          marginBottom: 10,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.3,
        }}
      >
        {project.project_name}
      </h3>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
          <span style={{ color: "#6b7280" }}>Confidence</span>
          <span style={{ color: "#111827", fontWeight: 600 }}>{formatConfidence(project)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
          <span style={{ color: "#6b7280" }}>NDVI</span>
          <span style={{ color: "#111827", fontWeight: 600 }}>{formatNdvi(project)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
          <span style={{ color: "#6b7280" }}>Price / Credit</span>
          <span style={{ color: "#111827", fontWeight: 600 }}>{formatPrice(project)}</span>
        </div>
      </div>

      <Link
        href={`/projects/${project.id}`}
        style={{
          marginTop: 12,
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "9px 0",
          background: "#bbf7d0",
          color: "#166534",
          border: "1px solid #86efac",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          textDecoration: "none",
        }}
      >
        Buy Project
      </Link>
    </div>
  );
}
