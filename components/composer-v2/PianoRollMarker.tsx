"use client";

import React from "react";
import type { LayoutMarker } from "@/lib/songDocV2";

export default function PianoRollMarker({
  marker,
  left,
  height,
  selected,
  onPointerDown,
}: {
  marker: LayoutMarker;
  left: number;
  height: number;
  selected: boolean;
  onPointerDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      style={{
        position: "absolute",
        left: left - 3,
        top: 0,
        width: 6,
        height,
        cursor: "grab",
        zIndex: selected ? 4 : 1,
        display: "flex",
        justifyContent: "center",
      }}
      title="Salto de línea"
      aria-label="Marcador de salto de línea"
    >
      <div
        style={{
          width: 2,
          height: "100%",
          background: selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
          boxShadow: selected ? "0 0 6px rgba(255,255,255,0.5)" : undefined,
        }}
      />
    </div>
  );
}
