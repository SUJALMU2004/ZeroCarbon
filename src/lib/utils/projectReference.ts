export function getProjectReference(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  const suffix = id.slice(-5).toUpperCase();
  return `PRJ-${year}-${suffix}`;
}

