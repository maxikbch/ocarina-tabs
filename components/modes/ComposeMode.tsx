"use client";

import React from "react";
import PianoKeyboard from "@/components/PianoKeyboard";
import SongTimeline from "@/components/SongTimeline";
import type { NoteLabelMode } from "@/lib/noteLabels";
import type { NoteEvent, NoteId } from "@/lib/types";

export default function ComposeMode({
  notes,
  noteLabelMode,
  testMode,
  freeMode,
  transpose,
  onTestModeChange,
  onFreeModeChange,
  onTransposeDec,
  onTransposeInc,
  onNoteClick,
  isEnabledNote,
  onAddSpace,
  onAddLineBreak,
  selectedSaved,
  savedNamesCount,
  songLength,
  onNewSong,
  onOpenSave,
  onOpenPicker,
  onDeleteSaved,
  onOpenRename,
  onExportPdf,
  displaySong,
  selectedId,
  onSelectEvent,
  onRemoveEvent,
  onReorderEvent,
}: {
  notes: string[];
  noteLabelMode: NoteLabelMode;
  testMode: boolean;
  freeMode: boolean;
  transpose: number;
  onTestModeChange: (next: boolean) => void;
  onFreeModeChange: (next: boolean) => void;
  onTransposeDec: () => void;
  onTransposeInc: () => void;
  onNoteClick: (note: string) => void | Promise<void>;
  isEnabledNote: (noteId: NoteId) => boolean;
  onAddSpace: () => void;
  onAddLineBreak: () => void;
  selectedSaved: string;
  savedNamesCount: number;
  songLength: number;
  onNewSong: () => void;
  onOpenSave: () => void;
  onOpenPicker: () => void;
  onDeleteSaved: () => void | Promise<void>;
  onOpenRename: () => void;
  onExportPdf: () => void | Promise<void>;
  displaySong: NoteEvent[];
  selectedId: string | null;
  onSelectEvent: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onReorderEvent: (sourceId: string, targetIndex: number) => void;
}) {
  function ToggleButton({
    active,
    label,
    onClick,
    title,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
    title: string;
  }) {
    return (
      <button
        onClick={onClick}
        aria-pressed={active}
        title={title}
        style={{
          padding: "8px 10px",
          borderRadius: 12,
          border: active ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.18)",
          background: active ? "#333" : "#1f1f1f",
          color: "#eaeaea",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 800,
          width: 68,
          textAlign: "center",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <section style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <div
        style={{
          position: "sticky",
          top: 12,
          zIndex: 50,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          padding: 10,
        }}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 900, textAlign: "center" }}>Teclado</div>
          <div style={{ position: "absolute", right: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onTransposeDec} style={{ padding: "3px 8px", borderRadius: 10 }}>
              –
            </button>
            <span style={{ minWidth: 24, textAlign: "center", fontSize: 12 }}>{transpose}</span>
            <button onClick={onTransposeInc} style={{ padding: "3px 8px", borderRadius: 10 }}>
              +
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "78px 1fr 78px",
            alignItems: "center",
            columnGap: 10,
            marginTop: 8,
          }}
        >
          <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
            <ToggleButton active={testMode} label="Test" title="Test Mode: no guardar notas al tocar" onClick={() => onTestModeChange(!testMode)} />
            <ToggleButton active={freeMode} label="Free" title="Free Mode: tocar todas las teclas" onClick={() => onFreeModeChange(!freeMode)} />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "min(100%, 780px)" }}>
              <PianoKeyboard notes={notes} labelMode={noteLabelMode} onNoteClick={onNoteClick} isEnabledNote={isEnabledNote} />
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
            <button
              onClick={onAddSpace}
              style={{ padding: "8px 8px", borderRadius: 12, width: "68px", height: "68px", whiteSpace: "nowrap", background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", fontSize: 12 }}
              title="Insertar un espacio en la canción"
            >
              Espacio
            </button>
            <button
              onClick={onAddLineBreak}
              style={{ padding: "8px 8px", borderRadius: 12, width: "68px", height: "68px", whiteSpace: "nowrap", background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", fontSize: 12 }}
              title="Insertar un salto de línea"
            >
              Salto
            </button>
          </div>
        </div>
      </div>

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

      <SongTimeline
        song={displaySong}
        selectedId={selectedId}
        onSelect={onSelectEvent}
        onRemove={onRemoveEvent}
        labelMode={noteLabelMode}
        onReorder={onReorderEvent}
        viewMode="notes"
      />
    </section>
  );
}

