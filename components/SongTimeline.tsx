"use client";

import React from "react";
import type { NoteEvent } from "@/lib/types";
import { formatNoteLabel, NoteLabelMode } from "@/lib/noteLabels";
import OcarinaSvg from "@/components/OcarinaSvg";

export default function SongTimeline({
  song,
  selectedId,
  onSelect,
  onRemove,
  labelMode = "latin",
  onReorder,
}: {
  song: NoteEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  labelMode?: NoteLabelMode;
  onReorder?: (sourceId: string, targetIndex: number) => void;
}) {
  return (
    <>
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        alignItems: "start",
      }}
    >
      {song.map((ev, idx) => {
        const selected = ev.id === selectedId;
        const isSpace = ev.note === "—" || ev.note === "SPACE";
        const isBreak = ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO";
        const isSpecial = isSpace || isBreak;
        const applySelected = selected && !isSpecial;
        return (
          <div
            key={ev.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", ev.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const sourceId = e.dataTransfer.getData("text/plain");
              if (!sourceId || sourceId === ev.id) return;
              onReorder?.(sourceId, idx);
            }}
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              borderRadius: 14,
              border: isSpecial
                ? "none"
                : applySelected
                ? "2px solid rgba(255,255,255,0.85)"
                : "1px solid rgba(255,255,255,0.18)",
              background: isSpecial ? "transparent" : applySelected ? "#333333" : "#555555",
              cursor: "pointer",
            }}
            onClick={() => onSelect(ev.id)}
          >
            {!isSpecial && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <div style={{ fontWeight: 800 }}>
                  {formatNoteLabel(ev.note, labelMode)}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(ev.id);
                  }}
                  style={{ marginLeft: "auto", padding: "2px 6px", border: "none", background: "none", fontSize: 14, top: "-1px", position: "relative" }}
                >
                  ✕
                </button>
              </div>
            )}
            {!isSpecial && <OcarinaSvg fingering={ev.fingering} width={100} showLabels={false}/>}
            {isSpace && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 0,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: 100,
                    height: 100,
                    position: "relative",
                    border: selected ? "2px solid rgba(255,255,255,0.6)" : "2px dashed rgba(255,255,255,0.35)",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  <div>Espacio</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(ev.id);
                    }}
                    title="Eliminar espacio"
                    aria-label="Eliminar espacio"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      padding: "2px 4px",
                      border: "none",
                      background: "none",
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {isBreak && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0, width: "100%" }}>
                <div
                  style={{
                    width: 100,
                    height: 100,
                    position: "relative",
                    border: selected ? "2px solid rgba(255,255,255,0.6)" : "2px dashed rgba(255,255,255,0.35)",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  <div>Salto</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(ev.id);
                    }}
                    title="Eliminar salto"
                    aria-label="Eliminar salto"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      padding: "2px 4px",
                      border: "none",
                      background: "none",
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {/* Zona de drop para insertar al final */}
      {song.length > 0 && (
        <div
          key="drop-end"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const sourceId = e.dataTransfer.getData("text/plain");
            if (!sourceId) return;
            onReorder?.(sourceId, song.length - 1);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            borderRadius: 14,
            border: "1px dashed rgba(255,255,255,0.2)",
            background: "#1a1a1a",
            boxSizing: "border-box",
            height: 131,
            color: "rgba(255,255,255,0.7)",
            userSelect: "none",
            textAlign: "center",
          }}
          title="Soltar aquí para mover al final"
          aria-label="Zona de drop al final"
        >
          Soltar aquí para mover al final
        </div>
      )}
    </div>
    {song.length === 0 && (
      <div style={{ opacity: 0.7 }}>Agregá notas con el teclado.</div>
    )}
    </>
  );
}
