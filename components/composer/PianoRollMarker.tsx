"use client";

import React from "react";
import type { LayoutMarker, SectionColorIndex } from "@/lib/songDocV2";
import { sectionColorCss } from "@/lib/sectionMarkers";

export type RollMarkerDisplay =
  | LayoutMarker
  | {
      kind: "marker";
      id: string;
      tick: number;
      marker: "section";
      name: string;
      color: SectionColorIndex;
      implicit?: boolean;
    };

export default function PianoRollMarker({
  marker,
  left,
  height,
  selected,
  sectionLabelTop,
  onPointerDown,
  onDoubleClick,
}: {
  marker: RollMarkerDisplay;
  left: number;
  height: number;
  selected: boolean;
  sectionLabelTop?: number;
  onPointerDown: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}) {
  const isSpace = marker.marker === "space";
  const isSection = marker.marker === "section";

  if (isSection) {
    const color = sectionColorCss(marker.color);
    const isImplicit = "implicit" in marker && marker.implicit === true;
    return (
      <div
        onMouseDown={(e) => {
          if (e.button === 2) return;
          e.stopPropagation();
          onPointerDown(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.(e);
        }}
        style={{
          position: "absolute",
          left: left - 2,
          top: 0,
          width: 28,
          height,
          cursor: isImplicit ? "default" : "grab",
          zIndex: selected ? 4 : 2,
          pointerEvents: "auto",
        }}
        title={`Sección: ${marker.name}${isImplicit ? " (Intro implícita)" : ""} — doble clic para editar`}
        aria-label={`Marcador de sección ${marker.name}`}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 3,
            height: "100%",
            background: color,
            boxShadow: selected ? `0 0 8px ${color}` : undefined,
            borderRadius: 1,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 9,
            top: sectionLabelTop ?? 0,
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            fontSize: 11,
            fontWeight: 800,
            color: selected ? "rgba(255,255,255,0.95)" : color,
            letterSpacing: 0.5,
            userSelect: "none",
            maxHeight: "85%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none",
          }}
        >
          {marker.name}
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseDown={(e) => {
        if (e.button === 2) return;
        e.stopPropagation();
        onPointerDown(e);
      }}
      style={{
        position: "absolute",
        left: left - (isSpace ? 10 : 3),
        top: 0,
        width: isSpace ? 20 : 6,
        height,
        cursor: "grab",
        zIndex: selected ? 4 : 1,
        display: "flex",
        justifyContent: "center",
        alignItems: isSpace ? "center" : "stretch",
        pointerEvents: "auto",
      }}
      title={isSpace ? "Espacio manual" : "Salto de línea"}
      aria-label={isSpace ? "Marcador de espacio" : "Marcador de salto de línea"}
    >
      {isSpace ? (
        <div
          style={{
            width: 2,
            height: "100%",
            borderLeft: "2px dashed rgba(255,255,255,0.65)",
            boxShadow: selected ? "0 0 6px rgba(255,255,255,0.5)" : undefined,
          }}
        />
      ) : (
        <div
          style={{
            width: 2,
            height: "100%",
            background: selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)",
            boxShadow: selected ? "0 0 6px rgba(255,255,255,0.5)" : undefined,
          }}
        />
      )}
    </div>
  );
}
