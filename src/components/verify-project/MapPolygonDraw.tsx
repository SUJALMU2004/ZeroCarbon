"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";

interface MapPolygonDrawProps {
  onPolygonChange: (geojson: object | null, hectares: number | null) => void;
  initialGeojson?: object | null;
}

type PolygonFeature = {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: Record<string, unknown>;
};

function toGeoJson(polygon: google.maps.Polygon): PolygonFeature {
  const path = polygon.getPath();
  const coordinates: number[][] = [];
  for (let i = 0; i < path.getLength(); i += 1) {
    const point = path.getAt(i);
    coordinates.push([point.lng(), point.lat()]);
  }

  if (coordinates.length > 0) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (!last || first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([...first]);
    }
  }

  const geojson: PolygonFeature = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
    properties: {},
  };
  return geojson;
}

function computeHectares(polygon: google.maps.Polygon) {
  if (typeof google === "undefined" || !google.maps.geometry?.spherical) {
    return null;
  }

  const areaSqM = google.maps.geometry.spherical.computeArea(polygon.getPath());
  const hectares = areaSqM / 10000;
  return Math.round(hectares * 100) / 100;
}

function PolygonController({
  onPolygonChange,
  initialGeojson,
  redrawSignal,
}: {
  onPolygonChange: (geojson: object | null, hectares: number | null) => void;
  initialGeojson: object | null;
  redrawSignal: number;
}) {
  const map = useMap();
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(
    null,
  );
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const editListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const completeListenerRef = useRef<google.maps.MapsEventListener | null>(
    null,
  );
  const initializedRef = useRef(false);
  const onPolygonChangeRef = useRef(onPolygonChange);

  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  });

  const clearEditListeners = useCallback(() => {
    editListenersRef.current.forEach((listener) => listener.remove());
    editListenersRef.current = [];
  }, []);

  const emitPolygonState = useCallback(
    (polygon: google.maps.Polygon) => {
      const geojson = toGeoJson(polygon);
      const hectares = computeHectares(polygon);
      onPolygonChangeRef.current(geojson, hectares);
    },
    [],
  );

  const attachEditListeners = useCallback(
    (polygon: google.maps.Polygon) => {
      clearEditListeners();
      const path = polygon.getPath();
      if (!path) return;
      editListenersRef.current.push(
        path.addListener("set_at", () => emitPolygonState(polygon)),
      );
      editListenersRef.current.push(
        path.addListener("insert_at", () => emitPolygonState(polygon)),
      );
      editListenersRef.current.push(
        path.addListener("remove_at", () => emitPolygonState(polygon)),
      );
    },
    [clearEditListeners, emitPolygonState],
  );

  useEffect(() => {
    if (!map) return;
    if (typeof google === "undefined" || !google.maps.drawing?.DrawingManager) {
      return;
    }

    if (!drawingManagerRef.current) {
      const drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControl: true,
        drawingControlOptions: {
          position: google.maps.ControlPosition.TOP_CENTER,
          drawingModes: [google.maps.drawing.OverlayType.POLYGON],
        },
        polygonOptions: {
          fillColor: "#16a34a",
          fillOpacity: 0.3,
          strokeColor: "#16a34a",
          strokeWeight: 2,
          editable: true,
        },
      });

      drawingManager.setMap(map);
      drawingManagerRef.current = drawingManager;

      const completeListener = drawingManager.addListener(
        "polygoncomplete",
        (polygon: google.maps.Polygon) => {
          if (polygonRef.current) {
            polygonRef.current.setMap(null);
          }
          polygonRef.current = polygon;
          drawingManager.setDrawingMode(null);
          attachEditListeners(polygon);
          emitPolygonState(polygon);
        },
      );
      completeListenerRef.current = completeListener;
    }

    if (!initializedRef.current && initialGeojson) {
      const feature = initialGeojson as {
        geometry?: {
          type?: string;
          coordinates?: number[][][];
        };
      };
      const coords = feature?.geometry?.coordinates?.[0];
      if (Array.isArray(coords) && coords.length > 2) {
        const path = coords
          .slice(0, -1)
          .map((pair: number[]) => ({ lng: pair[0], lat: pair[1] }));
        const polygon = new google.maps.Polygon({
          paths: path,
          fillColor: "#16a34a",
          fillOpacity: 0.3,
          strokeColor: "#16a34a",
          strokeWeight: 2,
          editable: true,
          map,
        });
        polygonRef.current = polygon;
        drawingManagerRef.current?.setDrawingMode(null);
        attachEditListeners(polygon);
        emitPolygonState(polygon);
      }
      initializedRef.current = true;
    }

    return () => {
      clearEditListeners();
      if (completeListenerRef.current) {
        completeListenerRef.current.remove();
        completeListenerRef.current = null;
      }
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    };
  }, [
    map,
    initialGeojson,
    attachEditListeners,
    clearEditListeners,
    emitPolygonState,
  ]);

  useEffect(() => {
    if (redrawSignal === 0) return;
    if (typeof google === "undefined") return;
    if (!drawingManagerRef.current) return;

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    clearEditListeners();
    drawingManagerRef.current.setDrawingMode(
      google.maps.drawing.OverlayType.POLYGON,
    );
    onPolygonChangeRef.current(null, null);
  }, [redrawSignal, clearEditListeners]);

  return null;
}

export default function MapPolygonDraw({
  onPolygonChange,
  initialGeojson = null,
}: MapPolygonDrawProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [hectares, setHectares] = useState<number | null>(null);
  const [redrawSignal, setRedrawSignal] = useState(0);

  const libraries = useMemo(() => ["drawing", "geometry"], []);

  const handlePolygonChange = useCallback(
    (geojson: object | null, area: number | null) => {
      setHectares(area);
      onPolygonChange(geojson, area);
    },
    [onPolygonChange],
  );

  if (!mapsApiKey) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Google Maps key is missing. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <APIProvider apiKey={mapsApiKey} libraries={libraries}>
        <Map
          mapTypeId="hybrid"
          defaultCenter={{ lat: 20.5937, lng: 78.9629 }}
          defaultZoom={5}
          gestureHandling="greedy"
          style={{ width: "100%", height: "400px" }}
        >
          <PolygonController
            onPolygonChange={handlePolygonChange}
            initialGeojson={initialGeojson}
            redrawSignal={redrawSignal}
          />
        </Map>
      </APIProvider>

      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
        <div className="text-sm text-gray-700">
          {hectares !== null ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
              Area: {hectares.toFixed(2)} hectares
            </span>
          ) : (
            "Draw a polygon to calculate area."
          )}
        </div>
        <button
          type="button"
          onClick={() => setRedrawSignal((value) => value + 1)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Redraw Area
        </button>
      </div>
    </div>
  );
}
