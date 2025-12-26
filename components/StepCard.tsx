"use client";

import React from "react";
import type { Fingering, NoteId } from "@/lib/types";
import OcarinaSvg from "./OcarinaSvg";
import { formatNoteLabel, NoteLabelMode } from "@/lib/noteLabels";

const CARD_WIDTH = 560;
const OCARINA_WIDTH = 560;

export default function StepCard({
  note,
  fingering,
  labelMode = "letter",
  imageHref,
}: {
  note: NoteId;
  fingering: Fingering;
  labelMode?: NoteLabelMode;
  imageHref?: string;
}) {
  return (
    <div
      style={{
        width: CARD_WIDTH,
        padding: 16,
        background: "#fff",
        border: "2px solid rgba(0, 0, 0, 0.15)",
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 52, fontWeight: 900, marginBottom: 12, color: "#000"}}>
        {formatNoteLabel(note, labelMode)}
      </div>
      <OcarinaSvg fingering={fingering} width={OCARINA_WIDTH} imageHref={imageHref} showLabels={false} />
    </div>
  );
}


