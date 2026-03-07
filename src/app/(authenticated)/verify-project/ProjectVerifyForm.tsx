"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ExistingProject = {
  id: string;
  project_name: string;
  project_type: string;
  status: string;
  submitted_at: string;
  review_notes: string | null;
};

type ProjectVerifyFormProps = {
  existingProjects: ExistingProject[];
  userEmail: string;
};

type ProjectFormData = {
  project_name: string;
  project_type: string;
  latitude: string;
  longitude: string;
  land_area_hectares: string;
  estimated_co2_per_year: string;
  project_start_date: string;
};

const ALLOWED_PROJECT_TYPES = ["forestry", "solar", "methane", "other"] as const;
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function todayDateIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function validateProjectForm(data: ProjectFormData, uploadState: string, hasFile: boolean): Record<string, string> {
  const errors: Record<string, string> = {};

  const projectName = data.project_name.trim();
  if (!projectName || projectName.length < 2 || projectName.length > 200) {
    errors.project_name = "Project name must be between 2 and 200 characters.";
  }

  if (!data.project_type || !ALLOWED_PROJECT_TYPES.includes(data.project_type as (typeof ALLOWED_PROJECT_TYPES)[number])) {
    errors.project_type = "Please select a valid project type.";
  }

  const latitude = Number(data.latitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = "Latitude must be a valid number between -90 and 90.";
  }

  const longitude = Number(data.longitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = "Longitude must be a valid number between -180 and 180.";
  }

  const landArea = Number(data.land_area_hectares);
  if (!Number.isFinite(landArea) || landArea <= 0) {
    errors.land_area_hectares = "Land area must be a positive number.";
  }

  const estimatedCo2 = Number(data.estimated_co2_per_year);
  if (!Number.isFinite(estimatedCo2) || estimatedCo2 <= 0) {
    errors.estimated_co2_per_year = "Estimated CO2 reduction must be a positive number.";
  }

  if (!data.project_start_date) {
    errors.project_start_date = "Project start date is required.";
  } else {
    const parsed = new Date(`${data.project_start_date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      errors.project_start_date = "Project start date must be valid.";
    } else {
      const minDate = new Date("1990-01-01T00:00:00Z");
      if (parsed < minDate) {
        errors.project_start_date = "Project start date must be after 1990-01-01.";
      }

      const today = new Date();
      const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      if (parsed > todayStart) {
        errors.project_start_date = "Start date cannot be in the future.";
      }
    }
  }

  if (uploadState === "uploading") {
    errors.document = "Please wait for document upload to complete.";
  }

  if (uploadState === "error" && hasFile) {
    errors.document = "Document upload failed. Please re-upload or remove the file.";
  }

  return errors;
}

export function ProjectVerifyForm({ existingProjects, userEmail }: ProjectVerifyFormProps) {
  const initialData = useMemo<ProjectFormData>(
    () => ({
      project_name: "",
      project_type: "",
      latitude: "",
      longitude: "",
      land_area_hectares: "",
      estimated_co2_per_year: "",
      project_start_date: "",
    }),
    [],
  );

  const [formData, setFormData] = useState<ProjectFormData>(initialData);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUploadProgress, setDocumentUploadProgress] = useState(0);
  const [documentUploadState, setDocumentUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadedDocumentPath, setUploadedDocumentPath] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<"idle" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submittedProjectName, setSubmittedProjectName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const latestRejectedProject = useMemo(
    () =>
      existingProjects.find(
        (project) =>
          project.status === "rejected" &&
          typeof project.review_notes === "string" &&
          project.review_notes.trim().length > 0,
      ) ?? null,
    [existingProjects],
  );

  const resetForm = () => {
    setFormData(initialData);
    setDocumentFile(null);
    setDocumentUploadProgress(0);
    setDocumentUploadState("idle");
    setUploadedDocumentPath(null);
    setErrors({});
    setIsSubmitting(false);
    setSubmitResult("idle");
    setSubmitMessage("");
    setSubmittedProjectName("");
  };

  const setFieldValue = (field: keyof ProjectFormData, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((previous) => {
        const next = { ...previous };
        delete next[field];
        return next;
      });
    }
  };

  const processFileSelection = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrors((previous) => ({
        ...previous,
        document: "File size must be 10MB or smaller.",
      }));
      setDocumentFile(null);
      setUploadedDocumentPath(null);
      setDocumentUploadState("error");
      setDocumentUploadProgress(0);
      return;
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number])) {
      setErrors((previous) => ({
        ...previous,
        document: "Only PDF, JPG, PNG, WEBP files are accepted.",
      }));
      setDocumentFile(null);
      setUploadedDocumentPath(null);
      setDocumentUploadState("error");
      setDocumentUploadProgress(0);
      return;
    }

    setDocumentFile(file);
    setUploadedDocumentPath(null);
    setDocumentUploadState("uploading");
    setDocumentUploadProgress(15);
    setErrors((previous) => {
      const next = { ...previous };
      delete next.document;
      return next;
    });

    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error("Unable to determine authenticated user for upload.");
      }

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `projects/${user.id}/${Date.now()}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setUploadedDocumentPath(path);
      setDocumentUploadProgress(100);
      setDocumentUploadState("done");
    } catch {
      setDocumentUploadState("error");
      setDocumentUploadProgress(0);
      setErrors((previous) => ({
        ...previous,
        document: "Upload failed. Please try again.",
      }));
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await processFileSelection(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await processFileSelection(file);
  };

  const handleRemoveFile = () => {
    setDocumentFile(null);
    setUploadedDocumentPath(null);
    setDocumentUploadState("idle");
    setDocumentUploadProgress(0);
    setErrors((previous) => {
      const next = { ...previous };
      delete next.document;
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validateProjectForm(formData, documentUploadState, Boolean(documentFile));
    setErrors(validationErrors);
    setSubmitResult("idle");
    setSubmitMessage("");

    const firstErrorField = Object.keys(validationErrors)[0];
    if (firstErrorField) {
      const element = document.getElementById(`project-${firstErrorField}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/verify-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_name: formData.project_name.trim(),
          project_type: formData.project_type,
          latitude: Number(formData.latitude),
          longitude: Number(formData.longitude),
          land_area_hectares: Number(formData.land_area_hectares),
          estimated_co2_per_year: Number(formData.estimated_co2_per_year),
          project_start_date: formData.project_start_date,
          document_path: uploadedDocumentPath,
          document_type: documentFile?.type ?? null,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
        field?: string;
      };

      if (!response.ok) {
        if (response.status === 400 && body.field) {
          setErrors((previous) => ({
            ...previous,
            [body.field as string]: body.error ?? "Please review this field.",
          }));
        }

        if (response.status === 409) {
          setErrors((previous) => ({
            ...previous,
            project_name: body.error ?? "A project with this name already exists.",
          }));
        }

        setSubmitResult("error");
        setSubmitMessage(body.error ?? "Unable to submit project. Please try again.");
        return;
      }

      setSubmittedProjectName(formData.project_name.trim());
      setSubmitResult("success");
      setSubmitMessage(body.message ?? "Project submitted for verification.");
    } catch {
      setSubmitResult("error");
      setSubmitMessage("Unable to submit project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitResult === "success") {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="rounded-2xl border border-green-200 bg-green-50 p-6 md:p-8"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-green-600" />
          <div>
            <h2 className="text-xl font-semibold text-green-800">Project Submitted for Verification!</h2>
            <p className="mt-2 text-sm text-green-700">{submitMessage}</p>
            <p className="mt-2 text-sm text-green-700">
              Your project &quot;{submittedProjectName}&quot; has been submitted.
            </p>
            <p className="mt-1 text-sm text-green-700">
              We&apos;ll review within 48-72 hours and notify you at {userEmail || "your account email"}.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-700"
          >
            Submit Another Project
          </button>
          <Link
            href="/dashboard/seller"
            className="inline-flex items-center justify-center rounded-xl border border-green-300 px-5 py-2.5 text-sm font-semibold text-green-800 transition-colors hover:bg-green-100"
          >
            &larr; Return to Dashboard
          </Link>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8"
    >
      {latestRejectedProject ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-semibold text-rose-900">Project Rejected</p>
          <p className="mt-1 text-sm text-rose-700">{latestRejectedProject.review_notes}</p>
        </div>
      ) : null}

      {existingProjects.length > 0 ? (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <p>You can submit additional projects. Existing submissions remain unchanged.</p>
        </div>
      ) : null}

      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Project Identity</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="project-project_name" className="mb-1 block text-sm font-medium text-gray-700">
              Project Name
            </label>
            <input
              id="project-project_name"
              type="text"
              value={formData.project_name}
              onChange={(event) => setFieldValue("project_name", event.target.value)}
              placeholder="e.g. Amazon Reforestation Zone A"
              maxLength={200}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.project_name ? <p className="mt-1 text-xs text-red-500">{errors.project_name}</p> : null}
          </div>

          <div>
            <label htmlFor="project-project_type" className="mb-1 block text-sm font-medium text-gray-700">
              Project Type
            </label>
            <select
              id="project-project_type"
              value={formData.project_type}
              onChange={(event) => setFieldValue("project_type", event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select project type</option>
              <option value="forestry">Forestry</option>
              <option value="solar">Solar</option>
              <option value="methane">Methane</option>
              <option value="other">Other</option>
            </select>
            {errors.project_type ? <p className="mt-1 text-xs text-red-500">{errors.project_type}</p> : null}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Location</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="project-latitude" className="mb-1 block text-sm font-medium text-gray-700">
              Latitude
            </label>
            <input
              id="project-latitude"
              type="number"
              step="0.000001"
              value={formData.latitude}
              onChange={(event) => setFieldValue("latitude", event.target.value)}
              placeholder="-3.4653"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.latitude ? <p className="mt-1 text-xs text-red-500">{errors.latitude}</p> : null}
          </div>

          <div>
            <label htmlFor="project-longitude" className="mb-1 block text-sm font-medium text-gray-700">
              Longitude
            </label>
            <input
              id="project-longitude"
              type="number"
              step="0.000001"
              value={formData.longitude}
              onChange={(event) => setFieldValue("longitude", event.target.value)}
              placeholder="-62.2159"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.longitude ? <p className="mt-1 text-xs text-red-500">{errors.longitude}</p> : null}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Scale</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="project-land_area_hectares" className="mb-1 block text-sm font-medium text-gray-700">
              Land Area in hectares
            </label>
            <input
              id="project-land_area_hectares"
              type="number"
              step="0.01"
              value={formData.land_area_hectares}
              onChange={(event) => setFieldValue("land_area_hectares", event.target.value)}
              placeholder="500"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.land_area_hectares ? <p className="mt-1 text-xs text-red-500">{errors.land_area_hectares}</p> : null}
          </div>

          <div>
            <label htmlFor="project-estimated_co2_per_year" className="mb-1 block text-sm font-medium text-gray-700">
              Estimated CO2 Reduction / Year (tCO2e)
            </label>
            <input
              id="project-estimated_co2_per_year"
              type="number"
              step="0.01"
              value={formData.estimated_co2_per_year}
              onChange={(event) => setFieldValue("estimated_co2_per_year", event.target.value)}
              placeholder="2500"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.estimated_co2_per_year ? <p className="mt-1 text-xs text-red-500">{errors.estimated_co2_per_year}</p> : null}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Timeline</h3>
        <div>
          <label htmlFor="project-project_start_date" className="mb-1 block text-sm font-medium text-gray-700">
            Project Start Date
          </label>
          <input
            id="project-project_start_date"
            type="date"
            min="1990-01-01"
            max={todayDateIso()}
            value={formData.project_start_date}
            onChange={(event) => setFieldValue("project_start_date", event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.project_start_date ? <p className="mt-1 text-xs text-red-500">{errors.project_start_date}</p> : null}
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Supporting Document</h3>

        <label
          htmlFor="project-document"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={handleDrop}
          className={`block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragOver
              ? "border-green-400 bg-green-50"
              : "border-gray-300 bg-gray-50 hover:border-green-300 hover:bg-green-50/50"
          }`}
        >
          <Upload className="mx-auto h-6 w-6 text-gray-400" />
          <p className="mt-2 text-sm text-gray-700">Drag and drop or click to upload</p>
          <p className="mt-1 text-xs text-gray-400">PDF, JPG, PNG, WEBP - max 10MB</p>
        </label>

        <input id="project-document" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />

        {documentFile ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{documentFile.name}</p>
                <p className="mt-1 text-xs text-gray-500">{formatFileSize(documentFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {documentUploadState === "uploading" || documentUploadState === "done" ? (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all duration-300"
                    style={{ width: `${documentUploadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {documentUploadState === "uploading" ? "Uploading document..." : "Upload complete"}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {errors.document ? <p id="project-document" className="mt-2 text-xs text-red-500">{errors.document}</p> : null}
      </section>

      {submitResult === "error" ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {submitMessage}
        </motion.p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        <span>{isSubmitting ? "Submitting..." : "Submit for Verification"}</span>
      </button>
    </motion.form>
  );
}
