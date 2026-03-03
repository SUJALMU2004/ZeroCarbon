import type { DashboardVerificationState, IdentityStatus } from "@/types/dashboard";

export type VerificationBannerModel = {
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
};

const PROFILE_ROUTE = "/profile";

function normalizeIdentityStatus(value: string | null | undefined): IdentityStatus {
  if (
    value === "not_submitted" ||
    value === "pending" ||
    value === "verified" ||
    value === "rejected" ||
    value === "resubmit_required"
  ) {
    return value;
  }

  return "not_submitted";
}

export function normalizeVerificationState(
  state: Partial<DashboardVerificationState> | null | undefined,
): DashboardVerificationState {
  return {
    phone_verified: state?.phone_verified === true,
    identity_status: normalizeIdentityStatus(state?.identity_status),
  };
}

export function getVerificationBannerModel(input: {
  isVerified: boolean;
  verificationState: DashboardVerificationState;
}): VerificationBannerModel | null {
  if (input.isVerified) {
    return null;
  }

  if (!input.verificationState.phone_verified) {
    return {
      message: "Verify your phone number to unlock marketplace access.",
      ctaLabel: "Verify Phone",
      ctaHref: PROFILE_ROUTE,
    };
  }

  if (input.verificationState.identity_status === "pending") {
    return {
      message: "Your identity verification is under review.",
    };
  }

  if (input.verificationState.identity_status === "rejected") {
    return {
      message: "Your identity verification was rejected. Please resubmit.",
      ctaLabel: "Complete Verification",
      ctaHref: PROFILE_ROUTE,
    };
  }

  if (input.verificationState.identity_status === "resubmit_required") {
    return {
      message: "Additional information required. Please resubmit verification.",
      ctaLabel: "Complete Verification",
      ctaHref: PROFILE_ROUTE,
    };
  }

  return {
    message: "Complete identity verification to start buying and selling credits.",
    ctaLabel: "Complete Verification",
    ctaHref: PROFILE_ROUTE,
  };
}

export function getFallbackBannerModel(): VerificationBannerModel {
  return {
    message: "Verify your identity to start buying and selling carbon credits.",
    ctaLabel: "Complete Verification",
    ctaHref: PROFILE_ROUTE,
  };
}
