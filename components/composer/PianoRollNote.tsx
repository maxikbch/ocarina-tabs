"use client";

import React from "react";
import { formatNoteLabel, type NoteLabelMode } from "@/lib/noteLabels";
import type { TimedNote } from "@/lib/songDocV2";

export default function PianoRollNote({
  note,
  top,
  left,
  width,
  rowHeight,
  selected,
  invalid,
  conflict,
  sameCell,
  sounding,
  voiceColor,
  labelMode,
  onPointerDown,
  onResizeStart,
}: {
  note: TimedNote;
  top: number;
  left: number;
  width: number;
  rowHeight: number;
  selected: boolean;
  invalid: boolean;
  conflict: boolean;
  sameCell: boolean;
  sounding?: boolean;
  voiceColor?: string;
  labelMode: NoteLabelMode;
  onPointerDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}) {
  const border = sameCell
    ? "2px solid rgba(255, 60, 60, 0.98)"
    : sounding
    ? "2px solid rgba(180, 255, 200, 0.98)"
    : conflict
    ? "2px solid rgba(255, 165, 0, 0.95)"
    : invalid
    ? "2px solid rgba(255, 80, 80, 0.85)"
    : selected
    ? "2px solid rgba(255,255,255,0.9)"
    : "1px solid rgba(255,255,255,0.35)";

  const baseVoiceBg = voiceColor ? `${voiceColor}bf` : "rgba(60,90,160,0.75)";

  const background = sameCell
    ? selected
      ? "rgba(160, 45, 45, 0.92)"
      : "rgba(130, 35, 35, 0.88)"
    : selected
    ? voiceColor
      ? `${voiceColor}ee`
      : "rgba(80,120,200,0.85)"
    : baseVoiceBg;

  return (
    <div
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).dataset.resize) return;
        if (e.button === 2) return;
        e.stopPropagation();
        onPointerDown(e);
      }}
      style={{
        position: "absolute",
        top,
        left,
        width: Math.max(8, width),
        height: rowHeight - 4,
        marginTop: 2,
        borderRadius: 6,
        border,
        background,
        cursor: "grab",
        display: "flex",
        alignItems: "center",
        padding: "0 6px",
        overflow: "hidden",
        userSelect: "none",
        boxSizing: "border-box",
        zIndex: selected || sounding ? 3 : 2,
        boxShadow: sounding ? "0 0 10px rgba(140, 255, 180, 0.45)" : undefined,
      }}
      title={
        sameCell
          ? `Duplicada: ${formatNoteLabel(note.note, labelMode)} en el mismo tiempo`
          : formatNoteLabel(note.note, labelMode)
      }
    >
      <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.95)", whiteSpace: "nowrap" }}>
        {formatNoteLabel(note.note, labelMode)}
      </span>
      <div
        data-resize="1"
        onMouseDown={(e) => {
          if (e.button === 2) return;
          e.stopPropagation();
          onResizeStart(e);
        }}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: "ew-resize",
          background: "rgba(255,255,255,0.15)",
        }}
      />
    </div>
  );
}
