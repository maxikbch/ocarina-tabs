"use client";

import React from "react";
import type { NoteEvent } from "@/lib/types";
import { formatNoteLabel, NoteLabelMode } from "@/lib/noteLabels";
import OcarinaSvg from "@/components/OcarinaSvg";
import { hasFingeringForNote } from "@/lib/fingerings";

export default function SongTimeline({
  song,
  selectedId,
  onSelect,
  onRemove,
  labelMode = "latin",
  onReorder,
  viewMode = "tabs",
  emptyText = "Agregá notas con el teclado.",
}: {
  song: NoteEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  labelMode?: NoteLabelMode;
  onReorder?: (sourceId: string, targetIndex: number) => void;
  viewMode?: "tabs" | "notes";
  emptyText?: string;
}) {
  const compact = viewMode === "notes";

  return (
    <>
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: compact ? "repeat(auto-fill, minmax(60px, 1fr))" : "repeat(auto-fill, minmax(110px, 1fr))",
        alignItems: "start",
      }}
    >
      {song.map((ev, idx) => {
        const selected = ev.id === selectedId;
        const isSpace = ev.note === "—" || ev.note === "SPACE";
        const isBreak = ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO";
        const isSpecial = isSpace || isBreak;
        const applySelected = selected && !isSpecial;
        const isInvalid = !isSpecial && !hasFingeringForNote(ev.note as any);
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
              display: compact ? "flex" : "grid",
              gap: compact ? 6 : 8,
              padding: compact ? 6 : 12,
              borderRadius: compact ? 12 : 14,
              position: "relative",
              border: isSpecial
                ? compact
                  ? selected
                    ? "2px solid rgba(255,255,255,0.6)"
                    : "1px dashed rgba(255,255,255,0.35)"
                  : "none"
                : applySelected
                ? "2px solid rgba(255,255,255,0.85)"
                : isInvalid
                ? "1px solid rgba(255, 80, 80, 0.6)"
                : "1px solid rgba(255,255,255,0.18)",
              background: isSpecial
                ? compact
                  ? "rgba(255,255,255,0.05)"
                  : "transparent"
                : isInvalid
                ? (applySelected ? "#4a2626" : "#5a2a2a")
                : applySelected
                ? "#333333"
                : "#555555",
              cursor: "pointer",
              alignItems: compact ? "center" : undefined,
              justifyContent: compact ? "center" : undefined,
              aspectRatio: compact ? "1 / 1" : undefined,
            }}
            onClick={() => onSelect(ev.id)}
          >
            {!isSpecial && !compact && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <div style={{ fontWeight: 800, fontSize: compact ? 12 : 14 }}>
                  {formatNoteLabel(ev.note, labelMode)}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(ev.id);
                  }}
                  style={{
                    marginLeft: "auto",
                    padding: "2px 6px",
                    border: "none",
                    background: "none",
                    fontSize: 14,
                    top: "-1px",
                    position: "relative",
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            {!isSpecial && compact && (
              <>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 12,
                    textAlign: "center",
                    lineHeight: 1,
                    color: "rgba(255,255,255,0.95)",
                    userSelect: "none",
                  }}
                >
                  {formatNoteLabel(ev.note, labelMode)}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(ev.id);
                  }}
                  aria-label="Borrar nota"
                  title="Borrar"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    padding: "0px 4px",
                    border: "none",
                    background: "none",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: 14,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </>
            )}
            {!isSpecial && !compact && (
              <div style={{ position: "relative", width: 100 }}>
                <OcarinaSvg fingering={ev.fingering} width={100} showLabels={false}/>
                {isInvalid && (
                  <div
                    title="Sin digitación para esta nota"
                    aria-label="Sin digitación para esta nota"
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        color: "#ff3b30",
                        fontSize: 84,
                        fontWeight: 900,
                        lineHeight: 1,
                        textShadow: "0 0 4px rgba(0,0,0,0.35)",
                        transform: "translateY(-2px)",
                      }}
                    >
                      ✕
                    </div>
                  </div>
                )}
              </div>
            )}
            {isSpace && (
              <>
                {compact ? (
                  <>
                    <div style={{ fontWeight: 900, fontSize: 14, textAlign: "center", lineHeight: 1, color: "rgba(255,255,255,0.9)", userSelect: "none" }}>—</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(ev.id);
                      }}
                      aria-label="Borrar espacio"
                      title="Borrar"
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        padding: "0px 4px",
                        border: "none",
                        background: "none",
                        color: "rgba(255,255,255,0.9)",
                        fontSize: 14,
                        lineHeight: 1,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </>
                ) : (
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
              </>
            )}
            {isBreak && (
              <>
                {compact ? (
                  <>
                    <div style={{ fontWeight: 900, fontSize: 14, textAlign: "center", lineHeight: 1, color: "rgba(255,255,255,0.9)", userSelect: "none" }}>↵</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(ev.id);
                      }}
                      aria-label="Borrar salto"
                      title="Borrar"
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        padding: "0px 4px",
                        border: "none",
                        background: "none",
                        color: "rgba(255,255,255,0.9)",
                        fontSize: 14,
                        lineHeight: 1,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </>
                ) : (
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
              </>
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
          onClick={() => onSelect("")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: compact ? 6 : 12,
            borderRadius: compact ? 12 : 14,
            border: "1px dashed rgba(255,255,255,0.2)",
            background: "#1a1a1a",
            boxSizing: "border-box",
            height: compact ? undefined : 131,
            aspectRatio: compact ? "1 / 1" : undefined,
            color: "rgba(255,255,255,0.7)",
            userSelect: "none",
            textAlign: "center",
            fontSize: compact ? 12 : 14,
          }}
          title="Soltar aquí para mover al final"
          aria-label="Zona de drop al final"
        >
          Mover al final
        </div>
      )}
    </div>
    {song.length === 0 && (
      <div style={{ opacity: 0.7 }}>{emptyText}</div>
    )}
    </>
  );
}
