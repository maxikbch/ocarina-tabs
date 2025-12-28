"use client";

import React from "react";
import type { Fingering, NoteId } from "@/lib/types";
import OcarinaSvg from "./OcarinaSvg";
import { formatNoteLabel, NoteLabelMode } from "@/lib/noteLabels";
import { hasFingeringForNote } from "@/lib/fingerings";

const CARD_WIDTH = 560;
const OCARINA_WIDTH = 560;

export default function StepCard({
  note,
  fingering,
  labelMode = "letter",
  imageHref,
  displayNote,
}: {
  note: NoteId;
  fingering: Fingering;
  labelMode?: NoteLabelMode;
  imageHref?: string;
  displayNote?: NoteId;
}) {
  const shown = (displayNote ?? note) as NoteId;
  const missing = !hasFingeringForNote(shown);
  return (
    <div
      style={{
        width: CARD_WIDTH,
        padding: 16,
        background: "#fff",
        border: "2px solid rgba(0, 0, 0, 0.15)",
        borderRadius: 12,
        position: "relative",
      }}
    >
      <div style={{ fontSize: 52, fontWeight: 900, marginBottom: 12, color: "#000"}}>
        {formatNoteLabel(shown as string, labelMode)}
      </div>
      <div style={{ position: "relative", width: OCARINA_WIDTH }}>
        <OcarinaSvg fingering={fingering} width={OCARINA_WIDTH} imageHref={imageHref} showLabels={false} />
        {missing && (
          <div
            title="Sin digitación para esta nota"
            aria-label="Sin digitación para esta nota"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                color: "#ff3b30",
                fontSize: 420,
                fontWeight: 900,
                lineHeight: 1,
                textShadow: "0 0 14px rgba(0,0,0,0.25)",
                transform: "translateY(-10px)",
              }}
            >
              ✕
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


