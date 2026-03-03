import {
  getFallbackBannerModel,
  getVerificationBannerModel,
  normalizeVerificationState,
} from "./verification-banner";

describe("getVerificationBannerModel", () => {
  it("returns null for fully verified users", () => {
    const result = getVerificationBannerModel({
      isVerified: true,
      verificationState: {
        phone_verified: true,
        identity_status: "verified",
      },
    });

    expect(result).toBeNull();
  });

  it("returns phone verification banner when phone is not verified", () => {
    const result = getVerificationBannerModel({
      isVerified: false,
      verificationState: {
        phone_verified: false,
        identity_status: "verified",
      },
    });

    expect(result).toEqual({
      message: "Verify your phone number to unlock marketplace access.",
      ctaLabel: "Verify Phone",
      ctaHref: "/profile",
    });
  });

  it("returns pending review banner without cta for pending identity", () => {
    const result = getVerificationBannerModel({
      isVerified: false,
      verificationState: {
        phone_verified: true,
        identity_status: "pending",
      },
    });

    expect(result).toEqual({
      message: "Your identity verification is under review.",
    });
  });

  it("returns not submitted banner with complete verification cta", () => {
    const result = getVerificationBannerModel({
      isVerified: false,
      verificationState: {
        phone_verified: true,
        identity_status: "not_submitted",
      },
    });

    expect(result).toEqual({
      message: "Complete identity verification to start buying and selling credits.",
      ctaLabel: "Complete Verification",
      ctaHref: "/profile",
    });
  });

  it("returns rejected banner with cta", () => {
    const result = getVerificationBannerModel({
      isVerified: false,
      verificationState: {
        phone_verified: true,
        identity_status: "rejected",
      },
    });

    expect(result).toEqual({
      message: "Your identity verification was rejected. Please resubmit.",
      ctaLabel: "Complete Verification",
      ctaHref: "/profile",
    });
  });

  it("returns resubmit required banner with cta", () => {
    const result = getVerificationBannerModel({
      isVerified: false,
      verificationState: {
        phone_verified: true,
        identity_status: "resubmit_required",
      },
    });

    expect(result).toEqual({
      message: "Additional information required. Please resubmit verification.",
      ctaLabel: "Complete Verification",
      ctaHref: "/profile",
    });
  });
});

describe("normalizeVerificationState", () => {
  it("normalizes malformed state to safest defaults", () => {
    const result = normalizeVerificationState({
      // @ts-expect-error testing malformed backend payload
      identity_status: "unknown",
      phone_verified: null,
    });

    expect(result).toEqual({
      phone_verified: false,
      identity_status: "not_submitted",
    });
  });
});

describe("getFallbackBannerModel", () => {
  it("returns safe non-verified fallback messaging", () => {
    expect(getFallbackBannerModel()).toEqual({
      message: "Verify your identity to start buying and selling carbon credits.",
      ctaLabel: "Complete Verification",
      ctaHref: "/profile",
    });
  });
});
