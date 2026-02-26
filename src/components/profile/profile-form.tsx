"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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
  initialVerificationStatus: VerificationStatus | null;
  initialVerificationDocumentType: string | null;
  initialVerificationSubmittedAt: string | null;
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

function getVerificationButtonLabel(status: VerificationStatus, isSubmitting: boolean): string {
  if (isSubmitting) {
    return "Submitting...";
  }

  if (status === "pending") {
    return "Re-upload & Retry Review";
  }

  if (status === "resubmit_required") {
    return "Upload New Document";
  }

  return "Submit Verification";
}

export function ProfileForm({
  userId,
  initialFullName,
  initialEmail,
  initialAvatarUrl,
  initialCreatedAt,
  initialVerificationStatus,
  initialVerificationDocumentType,
  initialVerificationSubmittedAt,
}: ProfileFormProps) {
  const saveInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);
  const verificationInFlightRef = useRef(false);
  const verificationFileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVerificationSubmitting, setIsVerificationSubmitting] = useState(false);
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
  const initials = getInitials(fullName, initialEmail);
  const isBusy = isSaving || isUploading || isVerificationSubmitting;
  const changePasswordHref = `/forgot-password?email=${encodeURIComponent(initialEmail)}`;
  const canSubmitVerification =
    verificationStatus === "not_submitted" ||
    verificationStatus === "pending" ||
    verificationStatus === "resubmit_required";

  function clearFeedback() {
    if (error) setError(null);
    if (success) setSuccess(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saveInFlightRef.current || isSaving || isUploading) return;

    setError(null);
    setSuccess(null);
    saveInFlightRef.current = true;
    setIsSaving(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const nameToSave = fullName.trim();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: nameToSave.length > 0 ? nameToSave : null,
        })
        .eq("id", userId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess("Profile updated successfully.");
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

    if (verificationInFlightRef.current || isBusy) {
      return;
    }

    clearFeedback();

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
            Verification is under review. If admin did not receive the email, you can re-upload to retry.
            <div className="mt-1 text-xs text-amber-700">
              Submitted at: {verificationSubmittedAtFormatted}
            </div>
          </div>
        ) : null}

        {verificationStatus === "rejected" ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            Not Verified
          </div>
        ) : null}

        {verificationStatus === "resubmit_required" ? (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Please upload a different document.
          </div>
        ) : null}

        {(verificationStatus === "not_submitted" ||
          verificationStatus === "pending" ||
          verificationStatus === "resubmit_required") && (
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
                disabled={!canSubmitVerification || isBusy}
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
                disabled={!canSubmitVerification || isBusy}
                onChange={handleVerificationFileChange}
                className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:font-semibold file:text-emerald-800 hover:file:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <p className="mt-2 text-xs text-slate-500">Accepted: JPG, PNG, WEBP. Max size 5MB.</p>
            </div>

            <button
              type="button"
              onClick={handleVerificationSubmit}
              disabled={!canSubmitVerification || isBusy || !verificationFile}
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
