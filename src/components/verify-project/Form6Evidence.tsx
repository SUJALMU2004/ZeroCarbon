"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, X } from "lucide-react";
import type { PhotoFile } from "@/types/verify-project";

interface Form6EvidenceProps {
  photos: Array<PhotoFile | null>;
  onPhotosChange: (photos: Array<PhotoFile | null>) => void;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
const MAX_BYTES = 10 * 1024 * 1024;

function toFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Form6Evidence({
  photos,
  onPhotosChange,
}: Form6EvidenceProps) {
  const galleryInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const cameraInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [slotErrors, setSlotErrors] = useState<string[]>(Array(6).fill(""));

  const setSlotError = (index: number, message: string) => {
    setSlotErrors((previous) => {
      const next = [...previous];
      next[index] = message;
      return next;
    });
  };

  const updatePhoto = (index: number, value: PhotoFile | null) => {
    const next = [...photos];
    const current = next[index];
    if (current?.previewUrl) {
      URL.revokeObjectURL(current.previewUrl);
    }
    next[index] = value;
    onPhotosChange(next);
  };

  const onSelectFile = (index: number, file: File | null) => {
    if (!file) return;
    setSlotError(index, "");

    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const hasSupportedType = fileType
      ? ACCEPTED_TYPES.includes(fileType)
      : fileName.endsWith(".jpg") ||
        fileName.endsWith(".jpeg") ||
        fileName.endsWith(".png") ||
        fileName.endsWith(".heic") ||
        fileName.endsWith(".heif");

    if (!hasSupportedType) {
      setSlotError(index, "Only JPG/JPEG/PNG/HEIC/HEIF files are allowed.");
      return;
    }

    if (file.size > MAX_BYTES) {
      setSlotError(index, "File exceeds 10MB limit.");
      return;
    }

    updatePhoto(index, {
      file,
      previewUrl: URL.createObjectURL(file),
      exifLat: null,
      exifLng: null,
      exifValid: true,
    });
    setSlotError(index, "");
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Upload photos of your project site.
        <ul className="mt-2 list-disc pl-5">
          <li>2 photos required, up to 6 accepted</li>
          <li>JPG/JPEG/PNG/HEIC/HEIF, max 10MB each</li>
          <li>Use Upload Image on desktop, or Upload Image/Camera on mobile</li>
          <li>
            Upload GPS-enabled photos. Non-GPS photos may cause application
            rejection during verification.
          </li>
        </ul>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Photos cannot be saved as draft and must be re-uploaded each session.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => {
          const photo = photos[index];
          const isRequired = index < 2;
          return (
            <div
              key={index + 1}
              className="rounded-xl border border-gray-200 bg-gray-50 p-3"
            >
              <p
                className={`mb-2 text-xs font-medium ${
                  isRequired ? "text-red-600" : "text-gray-500"
                }`}
              >
                Photo {index + 1} {isRequired ? "*" : "(Optional)"}
              </p>

              {!photo ? (
                <div className="space-y-2">
                  <div className="flex h-20 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-sm text-gray-600">
                    <Camera className="mb-1 h-5 w-5 text-gray-500" />
                    No photo selected
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                    <button
                      type="button"
                      onClick={() => galleryInputRefs.current[index]?.click()}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-700 hover:border-green-400 hover:text-green-700"
                    >
                      Upload Image
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRefs.current[index]?.click()}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-700 hover:border-green-400 hover:text-green-700 md:hidden"
                    >
                      Camera
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="relative h-28 w-full overflow-hidden rounded-lg">
                    <Image
                      src={photo.previewUrl}
                      alt={`Project evidence ${index + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-2 truncate text-xs text-gray-700">
                    {photo.file.name}
                  </p>
                  <p className="text-xs text-gray-500">{toFileSize(photo.file.size)}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Uploaded
                    </span>
                    <button
                      type="button"
                      onClick={() => updatePhoto(index, null)}
                      className="rounded-full p-1 text-gray-500 hover:bg-gray-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={(element) => {
                  galleryInputRefs.current[index] = element;
                }}
                type="file"
                accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  onSelectFile(index, file);
                  event.currentTarget.value = "";
                }}
              />

              <input
                ref={(element) => {
                  cameraInputRefs.current[index] = element;
                }}
                type="file"
                accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  onSelectFile(index, file);
                  event.currentTarget.value = "";
                }}
              />

              {slotErrors[index] ? (
                <p className="mt-2 text-xs text-red-500">{slotErrors[index]}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
