import "server-only";

function resolveEnv(primary: string, aliases: string[]): string {
  const candidates = [primary, ...aliases];

  for (const name of candidates) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing required environment variable: ${primary} (aliases: ${aliases.join(", ")})`,
  );
}

export function getClimatiqApiKey(): string {
  return resolveEnv("CLIMATIQ_API_KEY", ["climatiq_api_key"]);
}

export function getElectricityMapsApiKey(): string {
  return resolveEnv("ELECTRICITY_MAPS_API_KEY", ["electric_map_api_key"]);
}

export function getEmissionGeminiApiKey(): string {
  return resolveEnv("EMISSION_GEMINI_API_KEY", ["emision_gemini_api_key"]);
}
