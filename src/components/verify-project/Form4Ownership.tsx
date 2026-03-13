"use client";

import { Upload, X } from "lucide-react";
import type { OwnershipType, ProjectDraft } from "@/types/verify-project";

interface Form4OwnershipProps {
  draft: ProjectDraft;
  errors: Record<string, string>;
  ownershipFiles: File[];
  onFieldChange: <K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) => void;
  onOwnershipFilesChange: (files: File[]) => void;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const OWNERSHIP_OPTIONS: Array<{ value: OwnershipType; label: string }> = [
  { value: "owned", label: "Owned" },
  { value: "leased", label: "Leased" },
  { value: "community", label: "Community" },
];

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Form4Ownership({
  draft,
  errors,
  ownershipFiles,
  onFieldChange,
  onOwnershipFilesChange,
}: Form4OwnershipProps) {
  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const selected = Array.from(incoming);
    const valid = selected.filter(
      (file) => ALLOWED_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE,
    );
    const next = [...ownershipFiles, ...valid].slice(0, 3);
    onOwnershipFilesChange(next);
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="ownership_type"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Type of Ownership
          </label>
          <select
            id="ownership_type"
            value={draft.ownership_type}
            onChange={(event) =>
              onFieldChange(
                "ownership_type",
                event.target.value as ProjectDraft["ownership_type"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select ownership type</option>
            {OWNERSHIP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.ownership_type ? (
            <p className="mt-1 text-xs text-red-500">{errors.ownership_type}</p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            Upload Proof of Ownership
          </p>
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition-colors hover:border-green-400 hover:bg-green-50/50">
            <Upload className="mx-auto h-5 w-5 text-gray-500" />
            <p className="mt-2 text-sm text-gray-700">
              Drag files here or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PDF, JPG, PNG - Max 10MB - Up to 3 files
            </p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
          </label>
          {errors.ownership_documents ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.ownership_documents}
            </p>
          ) : null}
          {errors.ownership_files_invalid ? (
            <p className="mt-1 text-xs text-red-500">
              {errors.ownership_files_invalid}
            </p>
          ) : null}

          {ownershipFiles.length > 0 ? (
            <div className="mt-3 space-y-2">
              {ownershipFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-gray-800">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onOwnershipFilesChange(
                        ownershipFiles.filter((_, current) => current !== index),
                      )
                    }
                    className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.declaration_carbon_rights}
              onChange={(event) =>
                onFieldChange("declaration_carbon_rights", event.target.checked)
              }
              className="mt-1 h-4 w-4 accent-green-600"
            />
            <span>
              I declare that I hold the carbon rights for this project and have
              the legal authority to sell carbon credits on this platform.
            </span>
          </label>
          {errors.declaration_carbon_rights ? (
            <p className="text-xs text-red-500">
              {errors.declaration_carbon_rights}
            </p>
          ) : null}

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.declaration_document_use}
              onChange={(event) =>
                onFieldChange("declaration_document_use", event.target.checked)
              }
              className="mt-1 h-4 w-4 accent-green-600"
            />
            <span>
              I consent to the use of submitted documents for seller and project
              verification purposes by ZeroCarbon.
            </span>
          </label>
          {errors.declaration_document_use ? (
            <p className="text-xs text-red-500">
              {errors.declaration_document_use}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
