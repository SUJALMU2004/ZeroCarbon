import Image from "next/image";

interface ProjectPhotoGridItem {
  url: string;
  name: string;
}

interface ProjectPhotoGridProps {
  photos: ProjectPhotoGridItem[];
}

export default function ProjectPhotoGrid({ photos }: ProjectPhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
        No evidence photos available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((photo) => (
        <figure
          key={photo.url}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <div className="relative h-44 w-full">
            <Image
              src={photo.url}
              alt={photo.name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <figcaption className="truncate border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
            {photo.name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
