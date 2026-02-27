"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PhoneOtpModal } from "@/components/profile/phone-otp-modal";
import {
  getMissingRequiredIdentityFields,
  normalizeOptionalText,
  validateDateOfBirth,
  validatePhoneNumber,
  validatePostalCode,
  type IdentityFields,
} from "@/lib/profile/identity-validation";
import {
  DEFAULT_COUNTRY_CODE,
  filterCountryCodeOptions,
  splitE164Phone,
  buildE164Phone,
} from "@/lib/profile/country-codes";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_VERIFICATION_DOC_BYTES = 5 * 1024 * 1024;
const ALLOWED_VERIFICATION_DOC_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VERIFICATION_DOCUMENT_TYPES = [
  "Aadhar",
  "Passport",
  "National ID",
  "Driver License",
  "Voter ID",
  "Other Government ID",
] as const;

type VerificationStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required";

type ProfileFormProps = {
  userId: string;
  initialFullName: string | null;
  initialEmail: string;
  initialAvatarUrl: string | null;
  initialCreatedAt: string | null;
  initialDateOfBirth: string | null;
  initialPhoneNumber: string | null;
  initialAddressLine1: string | null;
  initialAddressLine2: string | null;
  initialCity: string | null;
  initialState: string | null;
  initialPostalCode: string | null;
  initialCountry: string | null;
  initialPhoneVerified: boolean;
  initialPhoneVerifiedAt: string | null;
  initialVerificationStatus: VerificationStatus | null;
  initialVerificationDocumentType: string | null;
  initialVerificationSubmittedAt: string | null;
};

type IdentityPayload = {
  full_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

type ConfirmPhoneResponse = {
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
  phone_verified?: boolean;
  phone_verified_at?: string | null;
  phone_number?: string | null;
};

function formatCreatedAt(value: string | null): string {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function getInitials(fullName: string, email: string): string {
  const source = fullName.trim() || email.split("@")[0] || "U";
  const parts = source.split(/[\s._-]+/).filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getFileExtension(mimeType: string): "jpg" | "png" | "webp" | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message ?? "";

    if (/jwt|session|auth session missing|not authenticated|unauthorized|expired/i.test(message)) {
      return "Your session expired. Please log in again.";
    }

    if (/network|failed to fetch/i.test(message)) {
      return "Network error. Please try again.";
    }

    return message || "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
}

function getOtpRequestErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message ?? ""
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (!message) {
    return "Unable to process OTP right now. Please try again.";
  }
  if (/invalid|expired|otp|token|code/i.test(message)) {
    return "Invalid or expired OTP. Please try again.";
  }
  if (/rate limit|too many requests|429/i.test(message)) {
    return "Too many attempts. Please wait and retry.";
  }
  if (/jwt|session|unauthorized|auth session missing|expired/i.test(message)) {
    return "Your session expired. Please log in again.";
  }

  return "Unable to process OTP right now. Please try again.";
}

function normalizeLocalPhoneInput(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function getVerificationButtonLabel(status: VerificationStatus, isSubmitting: boolean): string {
  if (isSubmitting) {
    return "Submitting...";
  }

  if (status === "resubmit_required") {
    return "Upload New Document";
  }

  if (status === "rejected") {
    return "Upload Different Document";
  }

  return "Submit Verification";
}

function buildIdentityFields(fields: {
  dateOfBirth: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}): IdentityFields {
  return {
    date_of_birth: normalizeOptionalText(fields.dateOfBirth),
    phone_number: normalizeOptionalText(fields.phoneNumber),
    address_line1: normalizeOptionalText(fields.addressLine1),
    address_line2: normalizeOptionalText(fields.addressLine2),
    city: normalizeOptionalText(fields.city),
    state: normalizeOptionalText(fields.state),
    postal_code: normalizeOptionalText(fields.postalCode),
    country: normalizeOptionalText(fields.country),
  };
}

export function ProfileForm({
  userId,
  initialFullName,
  initialEmail,
  initialAvatarUrl,
  initialCreatedAt,
  initialDateOfBirth,
  initialPhoneNumber,
  initialAddressLine1,
  initialAddressLine2,
  initialCity,
  initialState,
  initialPostalCode,
  initialCountry,
  initialPhoneVerified,
  initialPhoneVerifiedAt,
  initialVerificationStatus,
  initialVerificationDocumentType,
  initialVerificationSubmittedAt,
}: ProfileFormProps) {
  const saveInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);
  const verificationInFlightRef = useRef(false);
  const verificationFileInputRef = useRef<HTMLInputElement | null>(null);
  const initialPhoneParts = splitE164Phone(initialPhoneNumber);

  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth ?? "");
  const [phoneCountryCode, setPhoneCountryCode] = useState(initialPhoneParts.countryCode);
  const [phoneLocalNumber, setPhoneLocalNumber] = useState(initialPhoneParts.localNumber);
  const [countryCodeSearch, setCountryCodeSearch] = useState("");
  const [addressLine1, setAddressLine1] = useState(initialAddressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initialAddressLine2 ?? "");
  const [city, setCity] = useState(initialCity ?? "");
  const [stateValue, setStateValue] = useState(initialState ?? "");
  const [postalCode, setPostalCode] = useState(initialPostalCode ?? "");
  const [country, setCountry] = useState(initialCountry ?? "");
  const [savedPhoneNumber, setSavedPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(initialPhoneVerified));
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState(initialPhoneVerifiedAt);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVerificationSubmitting, setIsVerificationSubmitting] = useState(false);
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [isResendingPhoneOtp, setIsResendingPhoneOtp] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [isPhoneOtpModalOpen, setIsPhoneOtpModalOpen] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(
    initialVerificationStatus ?? "not_submitted",
  );
  const [verificationDocumentType, setVerificationDocumentType] = useState(
    initialVerificationDocumentType && initialVerificationDocumentType.trim().length > 0
      ? initialVerificationDocumentType
      : VERIFICATION_DOCUMENT_TYPES[0],
  );
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationSubmittedAt, setVerificationSubmittedAt] = useState(
    initialVerificationSubmittedAt,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const createdAt = formatCreatedAt(initialCreatedAt);
  const verificationSubmittedAtFormatted = formatTimestamp(verificationSubmittedAt);
  const phoneVerifiedAtFormatted = formatTimestamp(phoneVerifiedAt);
  const initials = getInitials(fullName, initialEmail);
  const selectedCountryCode =
    phoneCountryCode.trim().length > 0 ? phoneCountryCode : DEFAULT_COUNTRY_CODE;
  const filteredCountryOptions = filterCountryCodeOptions(countryCodeSearch);
  const hasSelectedCountryOption = filteredCountryOptions.some(
    (option) => option.dialCode === selectedCountryCode,
  );
  const countryCodeOptionsForSelect = hasSelectedCountryOption
    ? filteredCountryOptions
    : [
        {
          iso2: "ZZ",
          name: "Custom",
          dialCode: selectedCountryCode,
        },
        ...filteredCountryOptions,
      ];
  const builtPhoneInput = buildE164Phone(selectedCountryCode, phoneLocalNumber);
  const isIdentityLocked = verificationStatus === "verified";
  const isPhoneLocked = isIdentityLocked;
  const normalizedPhoneInput = normalizeOptionalText(builtPhoneInput);
  const normalizedSavedPhone = normalizeOptionalText(savedPhoneNumber);
  const savedPhoneValidationError = validatePhoneNumber(normalizedSavedPhone);
  const isPhoneDirty = normalizedPhoneInput !== normalizedSavedPhone;
  const shouldShowPhoneVerifiedBadge =
    phoneVerified && !isPhoneDirty && Boolean(normalizedSavedPhone);
  const canVerifyPhone =
    !isIdentityLocked &&
    !isPhoneDirty &&
    Boolean(normalizedSavedPhone) &&
    !phoneVerified &&
    !savedPhoneValidationError;
  const isBusy =
    isSaving ||
    isUploading ||
    isVerificationSubmitting ||
    isSendingPhoneOtp ||
    isVerifyingPhoneOtp ||
    isResendingPhoneOtp;
  const changePasswordHref = `/forgot-password?email=${encodeURIComponent(initialEmail)}`;
  const canSubmitVerification =
    verificationStatus === "not_submitted" ||
    verificationStatus === "resubmit_required" ||
    verificationStatus === "rejected";
  const isPhoneReadyForIdentitySubmission =
    phoneVerified && !isPhoneDirty && Boolean(normalizedSavedPhone);
  const canSubmitVerificationNow = canSubmitVerification && isPhoneReadyForIdentitySubmission;

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setResendCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [resendCooldownSeconds]);

  function clearFeedback() {
    if (error) setError(null);
    if (success) setSuccess(null);
  }

  function validateIdentityForSave(identityFields: IdentityFields): string | null {
    const dobValidationError = validateDateOfBirth(identityFields.date_of_birth);
    if (dobValidationError) {
      return dobValidationError;
    }

    const phoneValidationError = validatePhoneNumber(identityFields.phone_number);
    if (phoneValidationError) {
      return phoneValidationError;
    }

    const postalValidationError = validatePostalCode(identityFields.postal_code);
    if (postalValidationError) {
      return postalValidationError;
    }

    return null;
  }

  function validateIdentityForVerification(identityFields: IdentityFields): string | null {
    const missingFields = getMissingRequiredIdentityFields(identityFields);
    if (missingFields.length > 0) {
      return "Complete date of birth, phone, and address details before submitting verification.";
    }

    return validateIdentityForSave(identityFields);
  }

  function buildPayload(): IdentityPayload {
    const identityFields = buildIdentityFields({
      dateOfBirth,
      phoneNumber: normalizedPhoneInput ?? "",
      addressLine1,
      addressLine2,
      city,
      state: stateValue,
      postalCode,
      country,
    });

    return {
      full_name: normalizeOptionalText(fullName),
      date_of_birth: identityFields.date_of_birth,
      phone_number: identityFields.phone_number,
      address_line1: identityFields.address_line1,
      address_line2: identityFields.address_line2,
      city: identityFields.city,
      state: identityFields.state,
      postal_code: identityFields.postal_code,
      country: identityFields.country,
    };
  }

  function applyPhoneVerificationSuccess(
    body: ConfirmPhoneResponse | null,
    phone: string,
    fallbackSuccessMessage: string,
  ) {
    setPhoneVerified(Boolean(body?.phone_verified));
    setPhoneVerifiedAt(body?.phone_verified_at ?? new Date().toISOString());
    setSavedPhoneNumber(body?.phone_number ?? phone);
    setIsPhoneOtpModalOpen(false);
    setPhoneOtpError(null);
    setSuccess(body?.message ?? fallbackSuccessMessage);
  }

  function openPhoneOtpModal(isResend: boolean, retryAfterSeconds = 60) {
    setIsPhoneOtpModalOpen(true);
    setResendCooldownSeconds(retryAfterSeconds);
    setSuccess(
      isResend
        ? "OTP resent successfully."
        : "OTP sent successfully. Enter the code to complete verification.",
    );
  }

  function logPhoneOtpFailure(stage: string, status: number, code: string | undefined) {
    console.warn("phone_otp_send_failed", {
      stage,
      status,
      code: code ?? "unknown",
    });
  }

  async function sendPhoneOtp(isResend: boolean) {
    const targetPhone = normalizedSavedPhone;
    if (!targetPhone) {
      setPhoneOtpError("Please enter a valid phone number (e.g. +919876543210).");
      return;
    }

    const phoneValidationError = validatePhoneNumber(targetPhone);
    if (phoneValidationError) {
      setPhoneOtpError(phoneValidationError);
      return;
    }

    setPhoneOtpError(null);
    setError(null);

    if (isResend) {
      setIsResendingPhoneOtp(true);
    } else {
      setIsSendingPhoneOtp(true);
    }

    try {
      const response = await fetch("/api/phone/send-otp", {
        method: "POST",
      });
      let body: ConfirmPhoneResponse | null = null;
      try {
        body = (await response.json()) as ConfirmPhoneResponse;
      } catch {
        body = null;
      }

      if (!response.ok) {
        if (response.status === 429 && typeof body?.retryAfterSeconds === "number") {
          setResendCooldownSeconds(body.retryAfterSeconds);
        }
        logPhoneOtpFailure("send_otp_route_failed", response.status, body?.code);
        setPhoneOtpError(body?.message ?? "Unable to send OTP right now. Please try again.");
        return;
      }

      const retryAfterSeconds =
        typeof body?.retryAfterSeconds === "number" ? body.retryAfterSeconds : 60;
      openPhoneOtpModal(isResend, retryAfterSeconds);
    } catch (caughtError) {
      setPhoneOtpError(getOtpRequestErrorMessage(caughtError));
    } finally {
      setIsSendingPhoneOtp(false);
      setIsResendingPhoneOtp(false);
    }
  }

  async function handleVerifyPhoneClick() {
    if (!canVerifyPhone || isBusy) {
      return;
    }

    await sendPhoneOtp(false);
  }

  async function handleResendOtp() {
    if (resendCooldownSeconds > 0 || isResendingPhoneOtp || !isPhoneOtpModalOpen) {
      return;
    }

    await sendPhoneOtp(true);
  }

  async function handleConfirmOtp(otpCode: string) {
    if (isVerifyingPhoneOtp) {
      return;
    }

    if (!normalizedSavedPhone) {
      setPhoneOtpError("Phone verification mismatch. Save and verify again.");
      return;
    }

    setPhoneOtpError(null);
    setError(null);
    setIsVerifyingPhoneOtp(true);

    try {
      const response = await fetch("/api/phone/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedSavedPhone,
          code: otpCode,
        }),
      });
      let body: ConfirmPhoneResponse | null = null;
      try {
        body = (await response.json()) as ConfirmPhoneResponse;
      } catch {
        body = null;
      }

      if (!response.ok) {
        setPhoneOtpError(body?.message ?? "Invalid or expired OTP. Please try again.");
        return;
      }

      applyPhoneVerificationSuccess(
        body,
        normalizedSavedPhone,
        "Phone number verified successfully.",
      );
    } catch (caughtError) {
      setPhoneOtpError(getOtpRequestErrorMessage(caughtError));
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saveInFlightRef.current || isBusy) return;

    setError(null);
    setSuccess(null);
    saveInFlightRef.current = true;
    setIsSaving(true);

    try {
      const payload = buildPayload();
      const identityFields: IdentityFields = {
        date_of_birth: payload.date_of_birth,
        phone_number: payload.phone_number,
        address_line1: payload.address_line1,
        address_line2: payload.address_line2,
        city: payload.city,
        state: payload.state,
        postal_code: payload.postal_code,
        country: payload.country,
      };

      const validationError = validateIdentityForSave(identityFields);
      if (validationError) {
        setError(validationError);
        return;
      }

      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let body:
        | {
            message?: string;
            phone_number?: string | null;
            phone_verified?: boolean;
            phone_verified_at?: string | null;
            phone_verification_reset?: boolean;
          }
        | null = null;
      try {
        body = (await response.json()) as {
          message?: string;
          phone_number?: string | null;
          phone_verified?: boolean;
          phone_verified_at?: string | null;
          phone_verification_reset?: boolean;
        };
      } catch {
        body = null;
      }

      if (!response.ok) {
        setError(body?.message ?? "Unable to update profile right now. Please try again.");
        return;
      }

      setFullName(payload.full_name ?? "");
      setDateOfBirth(payload.date_of_birth ?? "");
      setAddressLine1(payload.address_line1 ?? "");
      setAddressLine2(payload.address_line2 ?? "");
      setCity(payload.city ?? "");
      setStateValue(payload.state ?? "");
      setPostalCode(payload.postal_code ?? "");
      setCountry(payload.country ?? "");
      const refreshedPhone =
        typeof body?.phone_number === "string" || body?.phone_number === null
          ? body.phone_number
          : payload.phone_number ?? null;
      const verificationReset = Boolean(body?.phone_verification_reset);
      const parsedRefreshedPhone = splitE164Phone(refreshedPhone ?? null);

      setSavedPhoneNumber(refreshedPhone ?? "");
      setPhoneCountryCode(parsedRefreshedPhone.countryCode);
      setPhoneLocalNumber(parsedRefreshedPhone.localNumber);
      if (typeof body?.phone_verified === "boolean") {
        setPhoneVerified(body.phone_verified);
      }
      if (body && "phone_verified_at" in body) {
        setPhoneVerifiedAt(body.phone_verified_at ?? null);
      }
      if (verificationReset) {
        setIsPhoneOtpModalOpen(false);
        setPhoneOtpError(null);
        setResendCooldownSeconds(0);
      }

      setSuccess(
        verificationReset
          ? "Profile updated. Phone changed and verification reset. Please verify again."
          : body?.message ?? "Profile updated successfully.",
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsSaving(false);
      saveInFlightRef.current = false;
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (uploadInFlightRef.current || isUploading || isSaving) return;

    setError(null);
    setSuccess(null);

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setError("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setError("File is too large. Maximum size is 2MB.");
      return;
    }

    const extension = getFileExtension(file.type);
    if (!extension) {
      setError("Unsupported image format.");
      return;
    }

    uploadInFlightRef.current = true;
    setIsUploading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const storagePath = `avatars/${userId}/profile.${extension}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(storagePath, file, {
        upsert: true,
        cacheControl: "3600",
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(storagePath);

      if (!publicUrl) {
        throw new Error("Unable to resolve avatar URL.");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
        })
        .eq("id", userId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setAvatarUrl(publicUrl);
      setSuccess("Profile photo updated successfully.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsUploading(false);
      uploadInFlightRef.current = false;
    }
  }

  function handleVerificationFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setVerificationFile(file);
    clearFeedback();
  }

  async function handleVerificationSubmit() {
    if (!canSubmitVerification) {
      setError("You cannot submit a document for verification in the current status.");
      return;
    }

    if (!isPhoneReadyForIdentitySubmission) {
      setError("Phone number must be verified before identity submission.");
      return;
    }

    if (verificationInFlightRef.current || isBusy) {
      return;
    }

    clearFeedback();

    const identityFields = buildIdentityFields({
      dateOfBirth,
      phoneNumber: normalizedPhoneInput ?? "",
      addressLine1,
      addressLine2,
      city,
      state: stateValue,
      postalCode,
      country,
    });

    const identityValidationError = validateIdentityForVerification(identityFields);
    if (identityValidationError) {
      setError(identityValidationError);
      return;
    }

    if (!verificationDocumentType || verificationDocumentType.trim().length === 0) {
      setError("Please select a document type.");
      return;
    }

    if (!verificationFile) {
      setError("Please select a verification document to upload.");
      return;
    }

    if (!ALLOWED_VERIFICATION_DOC_TYPES.has(verificationFile.type)) {
      setError("Invalid document type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    if (verificationFile.size > MAX_VERIFICATION_DOC_BYTES) {
      setError("Verification document exceeds 5MB limit.");
      return;
    }

    verificationInFlightRef.current = true;
    setIsVerificationSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("document_type", verificationDocumentType);
      payload.append("document", verificationFile);

      const response = await fetch("/api/verification/submit", {
        method: "POST",
        body: payload,
      });

      let body: { message?: string; status?: VerificationStatus; submittedAt?: string } | null = null;
      try {
        body = (await response.json()) as {
          message?: string;
          status?: VerificationStatus;
          submittedAt?: string;
        };
      } catch {
        body = null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          setError("Your session expired. Please log in again.");
        } else {
          setError(body?.message ?? "Unable to submit verification right now. Please try again.");
        }
        return;
      }

      setVerificationStatus(body?.status ?? "pending");
      setVerificationSubmittedAt(body?.submittedAt ?? new Date().toISOString());
      setVerificationFile(null);
      if (verificationFileInputRef.current) {
        verificationFileInputRef.current.value = "";
      }
      setSuccess(body?.message ?? "Verification submitted. Your documents are under review.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsVerificationSubmitting(false);
      verificationInFlightRef.current = false;
    }
  }

  return (
    <form className="mt-6 space-y-6" onSubmit={handleSave}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Profile</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profile avatar"
              className="h-20 w-20 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-slate-800 text-lg font-semibold text-white">
              {initials}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="avatar-upload"
              className={`inline-flex cursor-pointer items-center justify-center rounded-xl border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors duration-200 hover:bg-emerald-50 ${
                isBusy ? "cursor-not-allowed opacity-70" : ""
              }`}
            >
              {isUploading ? "Uploading..." : "Upload Photo"}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              disabled={isBusy}
              className="hidden"
            />
            <p className="text-xs text-slate-500">JPG, PNG, or WEBP. Max size 2MB.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Personal Info</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              id="full-name"
              name="full-name"
              type="text"
              value={fullName}
              disabled={isBusy}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div>
            <p className="mb-2 block text-sm font-medium text-slate-700">Email</p>
            <input
              type="email"
              value={initialEmail}
              disabled
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="date-of-birth" className="mb-2 block text-sm font-medium text-slate-700">
                Date of Birth
              </label>
              <input
                id="date-of-birth"
                type="date"
                value={dateOfBirth}
                disabled={isBusy || isIdentityLocked}
                onChange={(event) => setDateOfBirth(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
            <div>
              <label htmlFor="phone-number" className="mb-2 block text-sm font-medium text-slate-700">
                Phone Number
              </label>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                <div>
                  <label
                    htmlFor="phone-country-code-search"
                    className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-600"
                  >
                    Country Code
                  </label>
                  <input
                    id="phone-country-code-search"
                    type="text"
                    value={countryCodeSearch}
                    disabled={isBusy || isPhoneLocked}
                    onChange={(event) => setCountryCodeSearch(event.target.value)}
                    placeholder="Search country/code"
                    className="mb-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  <select
                    id="phone-country-code"
                    value={selectedCountryCode}
                    disabled={isBusy || isPhoneLocked}
                    onChange={(event) => {
                      setPhoneCountryCode(event.target.value);
                      setPhoneOtpError(null);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {countryCodeOptionsForSelect.length === 0 ? (
                      <option value={selectedCountryCode}>No matching country</option>
                    ) : (
                      countryCodeOptionsForSelect.map((option) => (
                        <option key={`${option.iso2}-${option.dialCode}`} value={option.dialCode}>
                          {option.name} ({option.dialCode})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="phone-number"
                    className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-600"
                  >
                    Local Number
                  </label>
                  <input
                    id="phone-number"
                    type="tel"
                    inputMode="numeric"
                    value={phoneLocalNumber}
                    disabled={isBusy || isPhoneLocked}
                    onChange={(event) => {
                      setPhoneLocalNumber(normalizeLocalPhoneInput(event.target.value));
                      setPhoneOtpError(null);
                    }}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    E.164 preview: {normalizedPhoneInput ?? "Incomplete phone number"}
                  </p>
                </div>
              </div>
              {isIdentityLocked ? (
                <p className="mt-1 text-xs text-slate-500">
                  Phone number is locked after identity verification.
                </p>
              ) : null}
              {!isIdentityLocked && isPhoneDirty && Boolean(normalizedPhoneInput) ? (
                <p className="mt-1 text-xs text-amber-700">
                  Save changes to verify this number.
                </p>
              ) : null}
              {!isIdentityLocked &&
              !isPhoneDirty &&
              Boolean(normalizedSavedPhone) &&
              savedPhoneValidationError ? (
                <p className="mt-1 text-xs text-amber-700">
                  Save a valid number to enable verification (example: +919876543210).
                </p>
              ) : null}
              {!isIdentityLocked && shouldShowPhoneVerifiedBadge ? (
                <div className="mt-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Verified{phoneVerifiedAt ? ` on ${phoneVerifiedAtFormatted}` : ""}
                </div>
              ) : null}
              {!isIdentityLocked && canVerifyPhone ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleVerifyPhoneClick}
                    disabled={isBusy || isPhoneDirty || !canVerifyPhone}
                    className="inline-flex items-center justify-center rounded-xl border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors duration-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSendingPhoneOtp ? "Sending OTP..." : "Verify Phone"}
                  </button>
                </div>
              ) : null}
              {!isPhoneOtpModalOpen && phoneOtpError ? (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {phoneOtpError}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor="address-line1" className="mb-2 block text-sm font-medium text-slate-700">
              Address Line 1
            </label>
            <input
              id="address-line1"
              type="text"
              value={addressLine1}
              disabled={isBusy || isIdentityLocked}
              onChange={(event) => setAddressLine1(event.target.value)}
              placeholder="Street address"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div>
            <label htmlFor="address-line2" className="mb-2 block text-sm font-medium text-slate-700">
              Address Line 2 (Optional)
            </label>
            <input
              id="address-line2"
              type="text"
              value={addressLine2}
              disabled={isBusy || isIdentityLocked}
              onChange={(event) => setAddressLine2(event.target.value)}
              placeholder="Apartment, suite, unit, etc."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="mb-2 block text-sm font-medium text-slate-700">
                City
              </label>
              <input
                id="city"
                type="text"
                value={city}
                disabled={isBusy || isIdentityLocked}
                onChange={(event) => setCity(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
            <div>
              <label htmlFor="state" className="mb-2 block text-sm font-medium text-slate-700">
                State
              </label>
              <input
                id="state"
                type="text"
                value={stateValue}
                disabled={isBusy || isIdentityLocked}
                onChange={(event) => setStateValue(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="postal-code" className="mb-2 block text-sm font-medium text-slate-700">
                Postal Code
              </label>
              <input
                id="postal-code"
                type="text"
                value={postalCode}
                disabled={isBusy || isIdentityLocked}
                onChange={(event) => setPostalCode(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
            <div>
              <label htmlFor="country" className="mb-2 block text-sm font-medium text-slate-700">
                Country
              </label>
              <input
                id="country"
                type="text"
                value={country}
                disabled={isBusy || isIdentityLocked}
                onChange={(event) => setCountry(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Created At</p>
            <p className="mt-1 text-slate-900">{createdAt}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
          User Verification
        </h2>

        {verificationStatus === "verified" ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Verified
          </div>
        ) : null}

        {verificationStatus === "pending" ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Verification under review. Upload is disabled while pending.
            <div className="mt-1 text-xs text-amber-700">
              Submitted at: {verificationSubmittedAtFormatted}
            </div>
          </div>
        ) : null}

        {verificationStatus === "rejected" ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Not Verified. You can upload a different document to retry verification.
          </div>
        ) : null}

        {verificationStatus === "resubmit_required" ? (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Please re-upload a different document.
          </div>
        ) : null}

        {canSubmitVerification && !isPhoneReadyForIdentitySubmission ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Phone number must be verified before identity submission.
          </div>
        ) : null}

        {(verificationStatus === "not_submitted" ||
          verificationStatus === "resubmit_required" ||
          verificationStatus === "rejected") && (
          <div className="mt-4 grid gap-4">
            <div>
              <label
                htmlFor="verification-document-type"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Document Type
              </label>
              <select
                id="verification-document-type"
                value={verificationDocumentType}
                disabled={!canSubmitVerificationNow || isBusy}
                onChange={(event) => {
                  setVerificationDocumentType(event.target.value);
                  clearFeedback();
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {VERIFICATION_DOCUMENT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="verification-document-file"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Verification Document
              </label>
              <input
                ref={verificationFileInputRef}
                id="verification-document-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!canSubmitVerificationNow || isBusy}
                onChange={handleVerificationFileChange}
                className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:font-semibold file:text-emerald-800 hover:file:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <p className="mt-2 text-xs text-slate-500">Accepted: JPG, PNG, WEBP. Max size 5MB.</p>
            </div>

            <button
              type="button"
              onClick={handleVerificationSubmit}
              disabled={!canSubmitVerificationNow || isBusy || !verificationFile}
              className="inline-flex items-center justify-center rounded-xl border border-sky-500 bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-sky-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {getVerificationButtonLabel(verificationStatus, isVerificationSubmitting)}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Account Actions</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex items-center justify-center rounded-xl border border-emerald-500 bg-linear-to-r from-emerald-500 to-green-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-emerald-400 hover:to-green-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>

          <Link
            href={changePasswordHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors duration-200 hover:border-emerald-300 hover:text-emerald-700"
          >
            Change Password
          </Link>

          <LogoutButton className="inline-flex items-center justify-center rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors duration-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70" />
        </div>
      </section>

      <PhoneOtpModal
        key={`${normalizedSavedPhone ?? ""}-${isPhoneOtpModalOpen ? "open" : "closed"}`}
        isOpen={isPhoneOtpModalOpen}
        phone={normalizedSavedPhone ?? ""}
        isSubmitting={isVerifyingPhoneOtp}
        isResending={isResendingPhoneOtp}
        resendCooldownSeconds={resendCooldownSeconds}
        errorMessage={phoneOtpError}
        onClose={() => {
          if (isVerifyingPhoneOtp) return;
          setIsPhoneOtpModalOpen(false);
          setPhoneOtpError(null);
        }}
        onSubmit={handleConfirmOtp}
        onResend={handleResendOtp}
      />

      {error ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {success}
        </p>
      ) : null}
    </form>
  );
}
