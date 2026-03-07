"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { ProjectSatelliteData } from "@/types/satellite";

interface ProjectInfoCardProps {
  project: ProjectSatelliteData;
}

function getProjectTypeBadgeStyle(projectType: string): CSSProperties {
  switch (projectType) {
    case "forestry":
      return { background: "#dcfce7", color: "#16a34a" };
    case "solar":
      return { background: "#fef9c3", color: "#ca8a04" };
    case "methane":
      return { background: "#dbeafe", color: "#1d4ed8" };
    default:
      return { background: "#f3f4f6", color: "#6b7280" };
  }
}

function getConfidenceStyle(badge: string | null): CSSProperties {
  if (badge === "High") return { background: "#dcfce7", color: "#16a34a" };
  if (badge === "Medium") return { background: "#fef9c3", color: "#ca8a04" };
  return { background: "#fee2e2", color: "#dc2626" };
}

function getTrendLabel(trend: string | null): { text: string; color: string } {
  if (trend === "positive") return { text: "↑ Vegetation Growing", color: "#16a34a" };
  if (trend === "negative") return { text: "↓ Declining", color: "#dc2626" };
  return { text: "→ Stable", color: "#6b7280" };
}

export default function ProjectInfoCard({ project }: ProjectInfoCardProps) {
  const typeBadgeStyle = useMemo(
    () => getProjectTypeBadgeStyle(project.project_type),
    [project.project_type],
  );

  const confidenceStyle = useMemo(
    () => getConfidenceStyle(project.satellite_confidence_badge ?? "Low"),
    [project.satellite_confidence_badge],
  );

  const trend = useMemo(
    () => getTrendLabel(project.satellite_ndvi_trend ?? null),
    [project.satellite_ndvi_trend],
  );

  const isForestry = project.project_type === "forestry";
  const isCompleted = project.satellite_status === "completed";
  const isProcessing = project.satellite_status === "processing";
  const isFailed = project.satellite_status === "failed";
  const locationConfirmed = (project.satellite_confidence_score ?? 0) > 20;

  return (
    <div
      style={{
        width: 240,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        padding: 0,
        color: "#111827",
      }}
    >
      <style>{`
        @keyframes zc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 8px",
          borderRadius: 9999,
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
          ...typeBadgeStyle,
        }}
      >
        {project.project_type}
      </span>

      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 10,
          lineHeight: 1.3,
        }}
      >
        {project.project_name}
      </div>

      {isProcessing ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              border: "2px solid #9ca3af",
              borderTopColor: "transparent",
              borderRadius: "50%",
              display: "inline-block",
              animation: "zc-spin 0.9s linear infinite",
            }}
          />
          <span>Analyzing satellite data...</span>
        </div>
      ) : null}

      {isFailed ? (
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Satellite analysis unavailable</div>
      ) : null}

      {isCompleted ? (
        <div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 9999,
              padding: "3px 8px",
              fontSize: 11,
              fontWeight: 600,
              ...confidenceStyle,
            }}
          >
            {(project.satellite_confidence_badge ?? "Low").toString()} Confidence •{" "}
            {project.satellite_confidence_score ?? 0}/100
          </span>

          {isForestry && project.satellite_ndvi_current !== null ? (
            <>
              <div style={{ marginTop: 6, fontSize: 12, color: "#374151" }}>
                NDVI: {project.satellite_ndvi_current.toFixed(3)}
              </div>
              <div style={{ marginTop: 2, fontSize: 11, color: trend.color }}>{trend.text}</div>
            </>
          ) : null}

          {!isForestry ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: locationConfirmed ? "#16a34a" : "#dc2626",
              }}
            >
              {locationConfirmed ? "📍 Location Confirmed" : "📍 Location Unconfirmed"}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        🌿 {project.estimated_co2_per_year.toLocaleString()} tCO2e/yr
      </div>

      <div style={{ marginTop: 4, fontSize: 11, color: "#9ca3af" }}>Price: Coming Soon</div>

      <button
        type="button"
        onClick={() => {
          window.location.href = "/projects";
        }}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "8px 0",
          background: "#16a34a",
          color: "#ffffff",
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "center",
        }}
      >
        View Project
      </button>
    </div>
  );
}
