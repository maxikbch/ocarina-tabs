"use client";

import React from "react";
import { CornerDownLeft, Flag, Minus, Pause, Play, Square } from "lucide-react";
import ToggleSwitch, { ToolbarSeparator } from "@/components/ToggleSwitch";
import { iconProps } from "@/components/icons";
import { eighthDivision, quarterDivision, sixteenthDivision, tickToBeatLabel, ticksToSeconds } from "@/lib/songTiming";
import type { SongDocV2, Tick } from "@/lib/songDocV2";

export type SnapDivision = "quarter" | "eighth" | "sixteenth" | "free";

export default function TransportBar({
  doc,
  playing,
  paused,
  playheadTick,
  onSnapChange,
  onPlay,
  onPause,
  onStop,
  onInsertLineBreak,
  onInsertSpace,
  onInsertSection,
  autoSpacesEnabled,
  onAutoSpacesEnabledChange,
  snap,
}: {
  doc: SongDocV2;
  playing: boolean;
  paused: boolean;
  playheadTick: Tick;
  snap: SnapDivision;
  onSnapChange: (snap: SnapDivision) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onInsertLineBreak: () => void;
  onInsertSpace: () => void;
  onInsertSection: () => void;
  autoSpacesEnabled: boolean;
  onAutoSpacesEnabledChange: (enabled: boolean) => void;
}) {
  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 10,
    background: "#1f1f1f",
    color: "#eaeaea",
    border: "1px solid rgba(255,255,255,0.15)",
    cursor: "pointer",
    fontSize: 13,
  };

  const secLabel = ticksToSeconds(playheadTick, doc.timing).toFixed(1);
  const beatLabel = tickToBeatLabel(playheadTick, doc.timing);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <button
        onClick={playing ? onPause : onPlay}
        style={{
          ...btnStyle,
          minWidth: 122,
          justifyContent: "center",
          border: playing
            ? "1px solid rgba(255, 200, 80, 0.35)"
            : "1px solid rgba(120, 200, 140, 0.35)",
          background: playing ? "rgba(80, 60, 30, 0.55)" : "rgba(40, 72, 52, 0.55)",
        }}
        title={playing ? "Pausar (Espacio)" : "Reproducir desde el playhead (Espacio)"}
      >
        {playing ? (
          <>
            <Pause {...iconProps()} />
            Pausar
          </>
        ) : (
          <>
            <Play {...iconProps()} />
            Reproducir
          </>
        )}
      </button>
      <button
        onClick={onStop}
        style={{
          ...btnStyle,
          border: "1px solid rgba(255, 120, 120, 0.35)",
        }}
        title="Detener y volver al inicio (Home)"
      >
        <Square {...iconProps()} />
        Detener
      </button>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "6px 10px",
          borderRadius: 8,
          background: playing
            ? "rgba(80, 140, 200, 0.25)"
            : paused
            ? "rgba(200, 150, 60, 0.2)"
            : "rgba(255,255,255,0.05)",
          border: `1px solid ${
            playing
              ? "rgba(120, 200, 255, 0.35)"
              : paused
              ? "rgba(255, 200, 80, 0.35)"
              : "rgba(255,255,255,0.12)"
          }`,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {beatLabel} · {secLabel}s
      </span>
      <ToolbarSeparator />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        Snap
        <select
          value={snap}
          onChange={(e) => onSnapChange(e.target.value as SnapDivision)}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "#1a1a1a",
            color: "#eaeaea",
          }}
        >
          <option value="quarter">Negra</option>
          <option value="eighth">Corchea</option>
          <option value="sixteenth">Semicorchea</option>
          <option value="free">Libre</option>
        </select>
      </label>
      <ToolbarSeparator />
      <button onClick={onInsertSection} style={btnStyle} title="Insertar marcador de sección en el cursor (doble clic para renombrar)">
        <Flag {...iconProps()} />
        Sección
      </button>
      <button onClick={onInsertLineBreak} style={btnStyle} title="Insertar salto de línea en el cursor">
        <CornerDownLeft {...iconProps()} />
        Salto de línea
      </button>
      <button onClick={onInsertSpace} style={btnStyle} title="Marcar un espacio en el cursor (como máximo uno por rango de silencio)">
        <Minus {...iconProps()} />
        Espacio
      </button>
      <ToggleSwitch
        checked={autoSpacesEnabled}
        onChange={onAutoSpacesEnabledChange}
        label="Espacios automáticos"
        fontSize={13}
      />
    </div>
  );
}

export function getSnapTicks(doc: SongDocV2, snap: SnapDivision): number {
  if (snap === "free") return 0;
  if (snap === "eighth") return eighthDivision(doc.timing);
  if (snap === "sixteenth") return sixteenthDivision(doc.timing);
  return quarterDivision(doc.timing);
}
