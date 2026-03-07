export type IdentityStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required";

export type DashboardVerificationState = {
  phone_verified: boolean;
  identity_status: IdentityStatus;
};

export type DashboardSummary = {
  email: string;
  role: string;
  created_at: string;
};

export type DashboardApiResponse = {
  is_verified: boolean;
  verification_state: DashboardVerificationState;
  dashboard: DashboardSummary;
};
