"use client";

import React, { useMemo, useLayoutEffect, useRef, useState } from "react";
import { formatNoteLabel, NoteLabelMode, parseNoteId } from "@/lib/noteLabels";

type Props = {
  notes: string[]; // cromático, ej: C4, C#4, ..., B4, C5
  labelMode: NoteLabelMode;
  onNoteClick: (noteId: string) => void;
  activeNoteId?: string;
  fitToWidth?: boolean; // ajusta por escala para evitar scroll horizontal
  isEnabledNote?: (noteId: string) => boolean;
};

const WHITE_ORDER = ["C","D","E","F","G","A","B"] as const;
const BLACK_AFTER: Record<string, string | null> = {
  C: "C#",
  D: "D#",
  E: null,
  F: "F#",
  G: "G#",
  A: "A#",
  B: null,
};

export default function PianoKeyboard({ notes, labelMode, onNoteClick, activeNoteId, fitToWidth = true, isEnabledNote }: Props) {
  // Agrupar por octava para layout
  const byOctave = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const n of notes) {
      const p = parseNoteId(n);
      if (!p) continue;
      const oct = parseInt((p.octave ?? "0"), 10);
      const set = map.get(oct) ?? new Set<string>();
      set.add(p.base + (p.accidental || ""));
      map.set(oct, set);
    }
    const entries = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    return entries.map(([oct, set]) => ({ octave: oct, steps: set }));
  }, [notes]);

  const WHITE_WIDTH = 44;
  const WHITE_HEIGHT = 180;
  const BLACK_WIDTH = Math.round(WHITE_WIDTH * 0.62);
  const BLACK_HEIGHT = Math.round(WHITE_HEIGHT * 0.6);

  const numOctaves = byOctave.length;
  const GAP = 8;
  const baseWidth = numOctaves * 7 * WHITE_WIDTH + Math.max(0, numOctaves - 1) * GAP;
  const baseHeight = WHITE_HEIGHT;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(1);

  useLayoutEffect(() => {
    if (!fitToWidth) return;
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const available = el.clientWidth || 0;
      const next = available > 0 ? Math.min(1, available / baseWidth) : 1;
      setScale(next);
    };

    compute();
    const ro = "ResizeObserver" in window ? new ResizeObserver(compute) : null;
    ro?.observe(el);
    const onResize = () => compute();
    window.addEventListener("resize", onResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [fitToWidth, baseWidth]);

  const keyboard = (
    <div style={{ display: "flex", gap: GAP }}>
      {byOctave.map(({ octave }) => {
        // Renderizar 7 blancas por octava
        return (
          <div key={octave} style={{ position: "relative", height: WHITE_HEIGHT }}>
            {/* Blancas */}
            <div style={{ display: "flex" }}>
              {WHITE_ORDER.map((w, i) => {
                const noteId = `${w}${octave}`;
                const noteName = `${w}`;
                const isActive = activeNoteId === noteId;
                const enabled = isEnabledNote ? isEnabledNote(noteId) : true;
                return (
                  <div
                    key={w}
                    onClick={() => enabled && onNoteClick(noteId)}
                    style={{
                      width: WHITE_WIDTH,
                      height: WHITE_HEIGHT,
                      border: "1px solid rgba(0,0,0,0.2)",
                      borderRadius: "0 0 6px 6px",
                      background: isActive ? "#fffae5" : "#fff",
                      cursor: enabled ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: 8,
                      userSelect: "none",
                      color: "#000",
                      opacity: enabled ? 1 : 0.35,
                      filter: enabled ? "none" : "grayscale(0.5)",
                    }}
                    title={enabled ? noteId : `${noteId} (sin digitación)`}
                  >
                    <div style={{ fontSize: 12, opacity: enabled ? 0.8 : 0.5 }}>
                      {formatNoteLabel(noteName, labelMode)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Negras, posicionadas absolutas */}
            {WHITE_ORDER.map((w, i) => {
              const black = BLACK_AFTER[w];
              if (!black) return null;
              const noteId = `${black}${octave}`;
              const noteName = `${black}`;
              const isActive = activeNoteId === noteId;
              const left = (i + 1) * WHITE_WIDTH - BLACK_WIDTH / 2;
              const enabled = isEnabledNote ? isEnabledNote(noteId) : true;
              return (
                <div
                  key={black}
                  onClick={() => enabled && onNoteClick(noteId)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left,
                    width: BLACK_WIDTH,
                    height: BLACK_HEIGHT,
                    background: isActive ? "#333" : "#222",
                    border: "1px solid #000",
                    borderRadius: "0 0 6px 6px",
                    cursor: enabled ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 6,
                    color: "#fff",
                    userSelect: "none",
                    opacity: enabled ? 1 : 0.4,
                    filter: enabled ? "none" : "grayscale(0.5)",
                  }}
                  title={enabled ? noteId : `${noteId} (sin digitación)`}
                >
                  <div style={{ fontSize: 10, opacity: enabled ? 0.9 : 0.5 }}>
                    {formatNoteLabel(noteName, labelMode)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  if (!fitToWidth) {
    return (
      <div style={{ paddingBottom: 8 }}>
        {keyboard}
      </div>
    );
  }

  // Ajuste por escala para evitar scroll
  return (
    <div ref={containerRef} style={{ width: "100%", height: Math.ceil(baseHeight * scale) + 8 /* padding */ }}>
      <div
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {keyboard}
      </div>
    </div>
  );
}


