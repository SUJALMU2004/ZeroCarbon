export type CountryCodeOption = {
  iso2: string;
  name: string;
  dialCode: string;
};

export const COUNTRY_CODE_OPTIONS: CountryCodeOption[] = [
  { iso2: "US", name: "United States", dialCode: "+1" },
  { iso2: "CA", name: "Canada", dialCode: "+1" },
  { iso2: "IN", name: "India", dialCode: "+91" },
  { iso2: "GB", name: "United Kingdom", dialCode: "+44" },
  { iso2: "AU", name: "Australia", dialCode: "+61" },
  { iso2: "SG", name: "Singapore", dialCode: "+65" },
  { iso2: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { iso2: "DE", name: "Germany", dialCode: "+49" },
  { iso2: "FR", name: "France", dialCode: "+33" },
  { iso2: "IT", name: "Italy", dialCode: "+39" },
  { iso2: "ES", name: "Spain", dialCode: "+34" },
  { iso2: "NL", name: "Netherlands", dialCode: "+31" },
  { iso2: "SE", name: "Sweden", dialCode: "+46" },
  { iso2: "NO", name: "Norway", dialCode: "+47" },
  { iso2: "DK", name: "Denmark", dialCode: "+45" },
  { iso2: "CH", name: "Switzerland", dialCode: "+41" },
  { iso2: "IE", name: "Ireland", dialCode: "+353" },
  { iso2: "BR", name: "Brazil", dialCode: "+55" },
  { iso2: "MX", name: "Mexico", dialCode: "+52" },
  { iso2: "ZA", name: "South Africa", dialCode: "+27" },
  { iso2: "NG", name: "Nigeria", dialCode: "+234" },
  { iso2: "JP", name: "Japan", dialCode: "+81" },
  { iso2: "KR", name: "South Korea", dialCode: "+82" },
  { iso2: "HK", name: "Hong Kong", dialCode: "+852" },
  { iso2: "NZ", name: "New Zealand", dialCode: "+64" },
];

export const DEFAULT_COUNTRY_CODE = "+1";

function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function buildE164Phone(countryCode: string, localNumber: string): string | null {
  const countryDigits = normalizeDigits(countryCode);
  const localDigits = normalizeDigits(localNumber);

  if (!countryDigits || !localDigits) {
    return null;
  }

  return `+${countryDigits}${localDigits}`;
}

export function splitE164Phone(
  phone: string | null,
): { countryCode: string; localNumber: string } {
  if (!phone || !phone.startsWith("+")) {
    return {
      countryCode: DEFAULT_COUNTRY_CODE,
      localNumber: "",
    };
  }

  const normalized = `+${normalizeDigits(phone)}`;
  const byLongestDialCode = [...COUNTRY_CODE_OPTIONS].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  );
  const matched = byLongestDialCode.find((option) =>
    normalized.startsWith(option.dialCode),
  );

  if (!matched) {
    const digits = normalizeDigits(normalized);
    if (!digits) {
      return {
        countryCode: DEFAULT_COUNTRY_CODE,
        localNumber: "",
      };
    }
    const inferredCountryCodeLength = digits.length > 4 ? 3 : 1;
    const inferredCountryCode = `+${digits.slice(0, inferredCountryCodeLength)}`;
    const inferredLocalNumber = digits.slice(inferredCountryCodeLength);

    return {
      countryCode: inferredCountryCode,
      localNumber: inferredLocalNumber,
    };
  }

  return {
    countryCode: matched.dialCode,
    localNumber: normalizeDigits(normalized.slice(matched.dialCode.length)),
  };
}

export function filterCountryCodeOptions(searchTerm: string): CountryCodeOption[] {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return COUNTRY_CODE_OPTIONS;
  }

  return COUNTRY_CODE_OPTIONS.filter((option) => {
    const haystack = `${option.name} ${option.iso2} ${option.dialCode}`.toLowerCase();
    return haystack.includes(term);
  });
}
