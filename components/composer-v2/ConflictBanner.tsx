"use client";

import React from "react";
import { storedToDisplay } from "@/lib/composerV2Display";
import { formatNoteLabel, type NoteLabelMode } from "@/lib/noteLabels";
import type { ConflictGroup, InvalidNoteRef, SameCellConflict } from "@/lib/songConflicts";
import type { SongDocV2 } from "@/lib/songDocV2";
import { normalizeSongDocV2 } from "@/lib/songDocV2";
import { tickToBeatLabel } from "@/lib/songTiming";

export type ConflictJumpTarget = {
  sectionId: string;
  start: number;
};

export default function ConflictBanner({
  conflicts,
  sameCellConflicts,
  outOfRangeNotes = [],
  composeTranspose = 0,
  doc,
  labelMode,
  onJumpToConflict,
}: {
  conflicts: ConflictGroup[];
  sameCellConflicts: SameCellConflict[];
  outOfRangeNotes?: InvalidNoteRef[];
  composeTranspose?: number;
  doc: SongDocV2;
  labelMode: NoteLabelMode;
  onJumpToConflict: (target: ConflictJumpTarget) => void;
}) {
  if (conflicts.length === 0 && sameCellConflicts.length === 0 && outOfRangeNotes.length === 0) {
    return null;
  }

  const overlapOnly = conflicts.filter(
    (g) => !sameCellConflicts.some((s) => s.noteIds.every((id) => g.noteIds.includes(id)) && g.noteIds.length === s.noteIds.length)
  );

  const songEvents = normalizeSongDocV2(doc).events;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {outOfRangeNotes.length > 0 ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255, 90, 90, 0.5)",
            background: "rgba(140, 35, 35, 0.2)",
            padding: "10px 12px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, color: "rgba(255, 190, 190, 0.98)" }}>
            Hay {outOfRangeNotes.length} nota{outOfRangeNotes.length === 1 ? "" : "s"} fuera de rango
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
            {composeTranspose !== 0
              ? "Con la transposición actual, estas notas no caen en una fila tocable (verde). Ajustá T hasta encajarlas."
              : "Estas notas no tienen digitación de ocarina en su fila. Transponé la vista o cambiá el pitch."}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {outOfRangeNotes.slice(0, 12).map((ref) => {
              const ev = songEvents.find((e) => e.kind === "note" && e.id === ref.noteId);
              const start = ev && ev.kind === "note" ? ev.start : 0;
              const display = storedToDisplay(ref.note, composeTranspose);
              return (
                <button
                  key={`oor:${ref.noteId}`}
                  onClick={() => onJumpToConflict({ sectionId: ref.sectionId, start })}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,120,120,0.35)",
                    background: "rgba(0,0,0,0.25)",
                    color: "#ffeaea",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <strong>Canción</strong> — {formatNoteLabel(display, labelMode)} en{" "}
                  {tickToBeatLabel(start, doc.timing)}
                </button>
              );
            })}
            {outOfRangeNotes.length > 12 ? (
              <div style={{ fontSize: 11, opacity: 0.65 }}>
                +{outOfRangeNotes.length - 12} más…
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {sameCellConflicts.length > 0 ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255, 70, 70, 0.55)",
            background: "rgba(180, 40, 40, 0.18)",
            padding: "10px 12px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, color: "rgba(255, 180, 180, 0.98)" }}>
            Notas duplicadas ({sameCellConflicts.length}): misma fila y columna en el piano roll
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
            Hay dos o más notas iguales en el mismo tiempo. Borrá o mové las que sobren.
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {sameCellConflicts.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onJumpToConflict({ sectionId: g.sectionId, start: g.start })}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,120,120,0.35)",
                    background: "rgba(0,0,0,0.25)",
                    color: "#ffeaea",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <strong>Canción</strong> — {formatNoteLabel(g.note, labelMode)} en{" "}
                  {tickToBeatLabel(g.start, doc.timing)} ({g.noteIds.length} notas)
                </button>
              ))}
          </div>
        </div>
      ) : null}

      {overlapOnly.length > 0 ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255, 165, 0, 0.45)",
            background: "rgba(255, 140, 0, 0.12)",
            padding: "10px 12px",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, color: "rgba(255, 200, 120, 0.98)" }}>
            Hay {overlapOnly.length} solapamiento{overlapOnly.length === 1 ? "" : "s"} en el tiempo. Resolvelos antes de tocar.
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {overlapOnly.map((g) => {
              const noteLabels = g.noteIds
                .map((id) => {
                  const ev = songEvents.find((e) => e.kind === "note" && e.id === id);
                  return ev && ev.kind === "note" ? formatNoteLabel(ev.note, labelMode) : "?";
                })
                .join(", ");
              return (
                <button
                  key={g.id}
                  onClick={() => onJumpToConflict({ sectionId: g.sectionId, start: g.start })}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(0,0,0,0.2)",
                    color: "#eaeaea",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <strong>Canción</strong> — {tickToBeatLabel(g.start, doc.timing)} ({noteLabels})
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}