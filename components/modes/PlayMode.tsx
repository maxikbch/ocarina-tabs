"use client";

import React from "react";
import SongTimeline from "@/components/SongTimeline";
import type { NoteLabelMode } from "@/lib/noteLabels";
import type { NoteEvent } from "@/lib/types";

export default function PlayMode({
  selectedSaved,
  savedNamesCount,
  onOpenPicker,
  song,
  selectedId,
  onSelectEvent,
  onRemoveEvent,
  onReorderEvent,
  noteLabelMode,
}: {
  selectedSaved: string;
  savedNamesCount: number;
  onOpenPicker: () => void;
  song: NoteEvent[];
  selectedId: string | null;
  onSelectEvent: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onReorderEvent: (sourceId: string, targetIndex: number) => void;
  noteLabelMode: NoteLabelMode;
}) {
  return (
    <section style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Canción{selectedSaved ? <span style={{ fontWeight: 400, opacity: 0.8 }}> — "{selectedSaved}"</span> : null}</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onOpenPicker}
          disabled={savedNamesCount === 0}
          style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
          title={savedNamesCount === 0 ? "No hay canciones guardadas" : "Abrir selector de canciones"}
        >
          Seleccionar canción
        </button>
      </div>
      <SongTimeline
        song={song}
        selectedId={selectedId}
        onSelect={onSelectEvent}
        onRemove={onRemoveEvent}
        labelMode={noteLabelMode}
        onReorder={onReorderEvent}
        viewMode="tabs"
        emptyText="Selecciona una cancion o crea una nueva en el modo componer"
      />
    </section>
  );
}

