export const BLOCKED_EMAIL_DOMAINS = new Set(["gmail.com", "yahoo.com"]);

export const BLOCKED_EMAIL_MESSAGE =
  "Please use your official company email address. Free email providers are not accepted.";

export function isBlockedEmailDomain(email: string): boolean {
  if (!email || !email.includes("@")) return false;

  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;

  return BLOCKED_EMAIL_DOMAINS.has(domain);
}

