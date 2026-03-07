type ConfidenceBadge = "High" | "Medium" | "Low";
type NdviTrend = "positive" | "flat" | "negative";
type ImageryQuality = "clear" | "cloudy" | "failed";

export function calculateForestryConfidence(
  ndviCurrent: number | null,
  ndviTrend: NdviTrend | null,
): { score: number; badge: ConfidenceBadge } {
  if (ndviCurrent === null) {
    return { score: 0, badge: "Low" };
  }

  if (ndviCurrent > 0.6 && ndviTrend === "positive") {
    const score = Math.min(100, Math.round(75 + (ndviCurrent - 0.6) * 62.5));
    return { score, badge: "High" };
  }

  if ((ndviCurrent >= 0.4 && ndviCurrent <= 0.6) || ndviTrend === "flat") {
    const normalized = Math.max(0, Math.min(1, (ndviCurrent - 0.4) / 0.2));
    const score = Math.round(40 + normalized * 34);
    return { score, badge: "Medium" };
  }

  if (ndviCurrent < 0.4 || ndviTrend === "negative") {
    const score = Math.round(Math.max(0, ndviCurrent * 97.5));
    return { score, badge: "Low" };
  }

  return { score: 20, badge: "Low" };
}

export function calculateLocationConfidence(
  imageryQuality: ImageryQuality | null,
): { score: number; badge: ConfidenceBadge } {
  if (imageryQuality === "clear") {
    return { score: 80, badge: "High" };
  }

  if (imageryQuality === "cloudy") {
    return { score: 50, badge: "Medium" };
  }

  return { score: 20, badge: "Low" };
}
