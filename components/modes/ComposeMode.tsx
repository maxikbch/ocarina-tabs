"use client";

import React from "react";
import ComposerWorkspace from "@/components/ComposerWorkspace";
import type { NoteLabelMode } from "@/lib/noteLabels";
import type { NoteId } from "@/lib/types";
import type { SongDoc } from "@/lib/songDoc";

export default function ComposeMode({
  notes,
  noteLabelMode,
  doc,
  onDocChange,
  testMode,
  freeMode,
  transpose,
  onTestModeChange,
  onFreeModeChange,
  onTransposeDec,
  onTransposeInc,
  isEnabledNote,
  onPreviewNote,
  selectedSaved,
  savedNamesCount,
  songLength,
  onNewSong,
  onOpenSave,
  onOpenPicker,
  onDeleteSaved,
  onOpenRename,
  stickyTopOffset = 12,
}: {
  notes: string[];
  noteLabelMode: NoteLabelMode;
  doc: SongDoc;
  onDocChange: (next: SongDoc) => void;
  testMode: boolean;
  freeMode: boolean;
  transpose: number;
  onTestModeChange: (next: boolean) => void;
  onFreeModeChange: (next: boolean) => void;
  onTransposeDec: () => void;
  onTransposeInc: () => void;
  isEnabledNote: (noteId: NoteId) => boolean;
  onPreviewNote: (note: string) => void | Promise<void>;
  selectedSaved: string;
  savedNamesCount: number;
  songLength: number;
  onNewSong: () => void;
  onOpenSave: () => void;
  onOpenPicker: () => void;
  onDeleteSaved: () => void | Promise<void>;
  onOpenRename: () => void;
  /** Offset desde el top del viewport para el sticky del teclado (p. ej. 12 + altura barra título en Electron) */
  stickyTopOffset?: number;
}) {
  return (
    <section style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
        Canción
        {selectedSaved ? (
          <>
            <span style={{ fontWeight: 400, opacity: 0.8 }}> — "{selectedSaved}"</span>
            <button
              onClick={onOpenRename}
              title="Renombrar canción"
              aria-label="Renombrar canción"
              style={{
                marginLeft: 8,
                padding: "2px 6px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "#eaeaea",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ✎
            </button>
          </>
        ) : null}
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={onNewSong}
            style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
            title="Crear una canción nueva (vacía)"
          >
            Nueva canción
          </button>

          <button
            onClick={onOpenSave}
            disabled={songLength === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              opacity: songLength === 0 ? 0.5 : 1,
              cursor: songLength === 0 ? "not-allowed" : "pointer",
            }}
            title="Guardar canción en memoria"
          >
            Guardar canción
          </button>

          <button
            onClick={onDeleteSaved}
            disabled={!selectedSaved}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              opacity: !selectedSaved ? 0.5 : 1,
              cursor: !selectedSaved ? "not-allowed" : "pointer",
            }}
            title="Eliminar canción guardada"
          >
            Borrar canción
          </button>
        </div>

        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={onOpenPicker}
            disabled={savedNamesCount === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              opacity: savedNamesCount === 0 ? 0.5 : 1,
              cursor: savedNamesCount === 0 ? "not-allowed" : "pointer",
            }}
            title={savedNamesCount === 0 ? "No hay canciones guardadas" : "Abrir selector de canciones"}
          >
            Seleccionar canción
          </button>
        </div>
      </div>

      <ComposerWorkspace
        notes={notes}
        labelMode={noteLabelMode}
        doc={doc}
        onDocChange={onDocChange}
        transpose={transpose}
        testMode={testMode}
        freeMode={freeMode}
        onTestModeChange={onTestModeChange}
        onFreeModeChange={onFreeModeChange}
        onTransposeDec={onTransposeDec}
        onTransposeInc={onTransposeInc}
        isEnabledNote={isEnabledNote}
        onPreviewNote={onPreviewNote}
        stickyTopOffset={stickyTopOffset}
      />
    </section>
  );
}

