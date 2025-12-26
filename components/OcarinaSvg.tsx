"use client";

import React from "react";
import type { Fingering, HoleId } from "@/lib/types";
import { HOLES } from "@/lib/ocarinaModel";

export default function OcarinaSvg({
  fingering,
  onToggleHole,
  showLabels = true,
  width = 520,
  imageHref = "/ocarina.png",
}: {
  fingering: Fingering;
  onToggleHole?: (holeId: HoleId) => void;
  showLabels?: boolean;
  width?: number;
  imageHref?: string;
}) {
  // PNG real: 481x336
  const vbW = 481;
  const vbH = 336;
  const height = Math.round((width * vbH) / vbW);

  return (
    <div style={{ width, userSelect: "none" }}>
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        width={width}
        height={height}
        role="img"
        aria-label="Digitación de ocarina"
      >
        {/* Fondo: tu PNG */}
        <image href={imageHref} x="0" y="0" width={vbW} height={vbH} />

        {/* Overlay interactivo */}
        {HOLES.map((h) => {
          const closed = fingering[h.id] === 1;
          return (
            <g
              key={h.id}
              style={{
                cursor: onToggleHole ? "pointer" : "default",
              }}
              onClick={() => onToggleHole?.(h.id)}
            >
              {/* “halo” para que se note bien qué está activo */}
              <circle
                cx={h.cx}
                cy={h.cy}
                r={h.r + 4}
                fill={closed ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.0)"}
              />

              {/* Relleno del agujero (tapado = negro semi) */}
              <circle
                cx={h.cx}
                cy={h.cy}
                r={h.r - 2}
                fill={closed ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.05)"}
                stroke={closed ? "rgba(0,0,0,0.0)" : "rgba(0,0,0,0.0)"}
              />

              {showLabels && (
                <text
                  x={h.cx}
                  y={h.cy + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={700}
                  fill={closed ? "white" : "rgba(0,0,0,0.55)"}
                >
                  {h.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
