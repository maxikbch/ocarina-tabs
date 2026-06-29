"use client";

import React from "react";
import { eighthDivision, quarterDivision, sixteenthDivision, tickToBeatLabel, ticksToSeconds } from "@/lib/songTiming";
import type { SongDocV2, Tick } from "@/lib/songDocV2";

export type SnapDivision = "quarter" | "eighth" | "sixteenth" | "free";

export default function TransportBar({
  doc,
  playing,
  paused,
  playheadTick,
  onSnapChange,
  onTempoChange,
  onPlay,
  onPause,
  onStop,
  onInsertLineBreak,
  snap,
}: {
  doc: SongDocV2;
  playing: boolean;
  paused: boolean;
  playheadTick: Tick;
  snap: SnapDivision;
  onSnapChange: (snap: SnapDivision) => void;
  onTempoChange: (tempo: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onInsertLineBreak: () => void;
}) {
  const btnStyle: React.CSSProperties = {
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
        onClick={onPlay}
        disabled={playing}
        style={{
          ...btnStyle,
          opacity: playing ? 0.5 : 1,
          cursor: playing ? "not-allowed" : "pointer",
          border: "1px solid rgba(120, 200, 140, 0.35)",
          background: "rgba(40, 72, 52, 0.55)",
        }}
        title="Reproducir desde el playhead (Espacio)"
      >
        ▶ Reproducir
      </button>
      <button
        onClick={onPause}
        disabled={!playing}
        style={{
          ...btnStyle,
          opacity: !playing ? 0.5 : 1,
          cursor: !playing ? "not-allowed" : "pointer",
          border: "1px solid rgba(255, 200, 80, 0.35)",
          background: paused ? "rgba(80, 60, 30, 0.55)" : "#1f1f1f",
        }}
        title="Pausar (Espacio)"
      >
        ⏸ Pausar
      </button>
      <button
        onClick={onStop}
        style={{
          ...btnStyle,
          border: "1px solid rgba(255, 120, 120, 0.35)",
        }}
        title="Detener y volver al inicio (Home)"
      >
        ⏹ Detener
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
      <button onClick={onInsertLineBreak} style={btnStyle} title="Insertar salto de línea en el cursor">
        ⏎ Salto de línea
      </button>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        BPM
        <input
          type="number"
          min={40}
          max={240}
          value={doc.timing.tempo}
          onChange={(e) => onTempoChange(Math.max(40, Math.min(240, Number(e.target.value) || 120)))}
          style={{
            width: 56,
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "#1a1a1a",
            color: "#eaeaea",
          }}
        />
      </label>
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
    </div>
  );
}

export function getSnapTicks(doc: SongDocV2, snap: SnapDivision): number {
  if (snap === "free") return 0;
  if (snap === "eighth") return eighthDivision(doc.timing);
  if (snap === "sixteenth") return sixteenthDivision(doc.timing);
  return quarterDivision(doc.timing);
}
