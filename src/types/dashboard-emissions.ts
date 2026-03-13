export type EmissionsRunAuditStatus = "SUCCESS_ZERO_TRUST_VERIFIED" | "FAILED";
export type EmissionsRunResultMode = "full" | "partial";

export type BuyerDashboardEmissionRun = {
  id: string;
  createdAt: string;
  auditStatus: EmissionsRunAuditStatus;
  resultMode: EmissionsRunResultMode;
  failureStage: string | null;
  errorMessage: string | null;
  scope1Tco2e: number | null;
  scope2Tco2e: number | null;
  scope3Tco2e: number | null;
  totalCorporateTco2e: number | null;
  providerDiagnostics: Record<string, unknown> | null;
};

export const BUYER_DASHBOARD_EMISSIONS_HISTORY_SELECT =
  "id, created_at, audit_status, failure_stage, error_message, scope_1_tco2e, scope_2_tco2e, scope_3_tco2e, total_corporate_tco2e, provider_diagnostics";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function parseDatabaseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function resolveRunResultMode(
  providerDiagnostics: unknown,
): EmissionsRunResultMode {
  const diagnostics = asObject(providerDiagnostics);
  if (!diagnostics) {
    return "full";
  }

  return diagnostics.result_mode === "partial" ? "partial" : "full";
}

export function normalizeBuyerDashboardEmissionRun(
  row: Record<string, unknown>,
): BuyerDashboardEmissionRun | null {
  const id = typeof row.id === "string" ? row.id : null;
  const createdAt =
    typeof row.created_at === "string" ? row.created_at : null;
  const auditStatus =
    row.audit_status === "FAILED" || row.audit_status === "SUCCESS_ZERO_TRUST_VERIFIED"
      ? row.audit_status
      : null;

  if (!id || !createdAt || !auditStatus) {
    return null;
  }

  const providerDiagnostics = asObject(row.provider_diagnostics);

  return {
    id,
    createdAt,
    auditStatus,
    resultMode: resolveRunResultMode(providerDiagnostics),
    failureStage:
      typeof row.failure_stage === "string" ? row.failure_stage : null,
    errorMessage:
      typeof row.error_message === "string" ? row.error_message : null,
    scope1Tco2e: parseDatabaseNumber(row.scope_1_tco2e),
    scope2Tco2e: parseDatabaseNumber(row.scope_2_tco2e),
    scope3Tco2e: parseDatabaseNumber(row.scope_3_tco2e),
    totalCorporateTco2e: parseDatabaseNumber(row.total_corporate_tco2e),
    providerDiagnostics,
  };
}
