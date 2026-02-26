export const PHONE_NUMBER_REGEX = /^\+[1-9]\d{7,14}$/;
export const POSTAL_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,12}$/;

export type IdentityFields = {
  date_of_birth: string | null;
  phone_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function getAgeYearsFromDateOnly(date: Date, now: Date): number {
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - date.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < date.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function validateDateOfBirth(dateOfBirth: string | null): string | null {
  if (!dateOfBirth) {
    return null;
  }

  const parsed = parseDateOnly(dateOfBirth);
  if (!parsed) {
    return "Please enter a valid date of birth.";
  }

  const now = new Date();
  const age = getAgeYearsFromDateOnly(parsed, now);
  if (age < 18) {
    return "You must be at least 18 years old.";
  }

  return null;
}

export function validatePhoneNumber(phoneNumber: string | null): string | null {
  if (!phoneNumber) {
    return null;
  }

  if (!PHONE_NUMBER_REGEX.test(phoneNumber)) {
    return "Please enter a valid phone number (e.g. +919876543210).";
  }

  return null;
}

export function validatePostalCode(postalCode: string | null): string | null {
  if (!postalCode) {
    return null;
  }

  if (!POSTAL_CODE_REGEX.test(postalCode)) {
    return "Please enter a valid postal code.";
  }

  return null;
}

export function getMissingRequiredIdentityFields(fields: IdentityFields): string[] {
  const missing: string[] = [];

  if (!fields.date_of_birth) missing.push("date_of_birth");
  if (!fields.phone_number) missing.push("phone_number");
  if (!fields.address_line1) missing.push("address_line1");
  if (!fields.city) missing.push("city");
  if (!fields.state) missing.push("state");
  if (!fields.postal_code) missing.push("postal_code");
  if (!fields.country) missing.push("country");

  return missing;
}

export function formatAddressForEmail(fields: IdentityFields): string {
  const parts = [
    fields.address_line1,
    fields.address_line2,
    fields.city,
    fields.state,
    fields.postal_code,
    fields.country,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  return parts.length > 0 ? parts.join(", ") : "Not provided";
}
