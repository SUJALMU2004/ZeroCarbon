"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProjectProductGalleryProps {
  images: Array<{
    mainUrl: string;
    thumbUrl: string;
  }>;
  selectedImage: number;
  onSelectImage: (index: number) => void;
}

export default function ProjectProductGallery({
  images,
  selectedImage,
  onSelectImage,
}: ProjectProductGalleryProps) {
  const hasImages = images.length > 0;

  const handlePrevious = () => {
    if (!hasImages) return;
    onSelectImage((selectedImage - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    if (!hasImages) return;
    onSelectImage((selectedImage + 1) % images.length);
  };

  if (!hasImages) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="text-sm font-medium text-gray-500">No project photos available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="group relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-slate-100">
        <Image
          src={images[selectedImage].mainUrl}
          alt={`Project image ${selectedImage + 1}`}
          fill
          unoptimized
          loading="eager"
          fetchPriority="high"
          className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={handlePrevious}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-700 opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-700 opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="absolute bottom-3 right-3 rounded-full border border-white/40 bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          {selectedImage + 1} / {images.length}
        </div>
      </div>

      {images.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={`${image.thumbUrl}-${index}`}
              type="button"
              onClick={() => onSelectImage(index)}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                selectedImage === index
                  ? "border-green-500 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              aria-label={`View project image ${index + 1}`}
            >
              <Image
                src={image.thumbUrl}
                alt={`Project thumbnail ${index + 1}`}
                fill
                unoptimized
                loading="lazy"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
