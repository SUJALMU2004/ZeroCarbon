"use client";

import { Tiles } from "@/components/ui/tiles";

export function TilesDemo() {
  return (
    <div className="h-125 w-full">
      <Tiles rows={50} cols={8} tileSize="md" />
    </div>
  );
}
