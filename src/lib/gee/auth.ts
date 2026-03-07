import "server-only";

import { JWT } from "google-auth-library";

type ServiceAccountKey = {
  client_email?: string;
  private_key?: string;
};

function getServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.GEE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("Missing GEE_SERVICE_ACCOUNT_KEY");
  }

  try {
    return JSON.parse(raw) as ServiceAccountKey;
  } catch {
    throw new Error("GEE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }
}

export async function getGeeAccessToken(): Promise<string> {
  const key = getServiceAccountKey();
  const email = key.client_email || process.env.GEE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = key.private_key;

  if (!email) {
    throw new Error("Missing GEE service account email in credentials");
  }

  if (!privateKey) {
    throw new Error("Missing GEE service account private key in credentials");
  }

  const client = new JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/earthengine"],
  });

  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to get GEE access token");
  }

  return tokenResponse.token;
}
