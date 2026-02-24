"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import type { NoteEvent } from "@/lib/types";
import { formatNoteLabel, NoteLabelMode } from "@/lib/noteLabels";
import OcarinaSvg from "@/components/OcarinaSvg";
import { hasFingeringForNote } from "@/lib/fingerings";

function useGridColumns(minCellPx: number, gapPx: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(1);
  const colsRef = useRef(1);
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth || 0;
      if (width <= 0) return;
      const next = Math.max(1, Math.floor((width + gapPx) / (minCellPx + gapPx)));
      if (next !== colsRef.current) {
        colsRef.current = next;
        setCols(next);
      }
    };
    update();
    const ro = new ResizeObserver(() => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [minCellPx, gapPx]);

  return { ref, cols };
}

export default function SongTimeline({
  song,
  selectedId,
  onSelect,
  onRemove,
  labelMode = "latin",
  onReorder,
  viewMode = "tabs",
  emptyText = "Agregá notas con el teclado.",
  editable = true,
  scale = 1,
  forceSquare = false,
  invisibleSpaces = false,
  lineBreaksAsNewline = false,
}: {
  song: NoteEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  labelMode?: NoteLabelMode;
  onReorder?: (sourceId: string, targetIndex: number) => void;
  viewMode?: "tabs" | "notes";
  emptyText?: string;
  editable?: boolean;
  scale?: number;
  forceSquare?: boolean;
  invisibleSpaces?: boolean;
  lineBreaksAsNewline?: boolean;
}) {
  const compact = viewMode === "notes";
  const s = Math.max(0.2, Math.min(2, scale || 1));
  const gap = Math.round(12 * s);
  const minCol = compact ? Math.round(60 * s) : Math.round(110 * s);
  const pad = compact ? Math.round(6 * s) : Math.round(12 * s);
  const radius = compact ? Math.round(12 * s) : Math.round(14 * s);
  const itemGap = Math.max(2, Math.round((compact ? 6 : 8) * s));
  const innerMax = Math.max(24, minCol - pad * 2);
  const ocarinaW = Math.min(Math.round(100 * s), innerMax);
  const tabsLabelFont = Math.max(8, Math.round(14 * s * 0.75));
  const compactLabelFont = Math.max(8, Math.round(12 * s));
  const specialGlyphFont = Math.max(8, Math.round(14 * s));

  const grid = useGridColumns(minCol, gap);
  const effectiveCols = Math.max(1, grid.cols || 1);

  const renderCell = (ev: NoteEvent, idx: number) => {
    const selected = ev.id === selectedId;
    const isSpace = ev.note === "—" || ev.note === "SPACE";
    const isBreak = ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO";
    const isSpecial = isSpace || isBreak;
    const applySelected = selected && !isSpecial;
    const isInvalid = !isSpecial && !hasFingeringForNote(ev.note as any);

    return (
      <div
        key={ev.id}
        draggable={editable}
        onDragStart={
          editable
            ? (e) => {
                e.dataTransfer.setData("text/plain", ev.id);
                e.dataTransfer.effectAllowed = "move";
              }
            : undefined
        }
        onDragOver={
          editable
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }
            : undefined
        }
        onDrop={
          editable
            ? (e) => {
                e.preventDefault();
                const sourceId = e.dataTransfer.getData("text/plain");
                if (!sourceId || sourceId === ev.id) return;
                onReorder?.(sourceId, idx);
              }
            : undefined
        }
        style={{
          display: compact ? "flex" : "grid",
          gap: itemGap,
          padding: pad,
          borderRadius: radius,
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
            ? applySelected
              ? "#4a2626"
              : "#5a2a2a"
            : applySelected
            ? "#333333"
            : "#555555",
          cursor: "pointer",
          alignItems: compact ? "center" : undefined,
          justifyContent: compact ? "center" : undefined,
          aspectRatio: compact || forceSquare ? "1 / 1" : undefined,
          gridTemplateRows: !compact && forceSquare ? "auto 1fr" : undefined,
          overflow: !compact && forceSquare ? "hidden" : undefined,
        }}
        onClick={() => onSelect(ev.id)}
      >
        {!isSpecial && !compact && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <div style={{ fontWeight: 800, fontSize: tabsLabelFont }}>
              {formatNoteLabel(ev.note, labelMode)}
            </div>
            {editable ? (
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
            ) : null}
          </div>
        )}
        {!isSpecial && compact && (
          <>
            <div
              style={{
                fontWeight: 900,
                fontSize: compactLabelFont,
                textAlign: "center",
                lineHeight: 1,
                color: "rgba(255,255,255,0.95)",
                userSelect: "none",
              }}
            >
              {formatNoteLabel(ev.note, labelMode)}
            </div>
            {editable ? (
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
            ) : null}
          </>
        )}
        {!isSpecial && !compact && (
          <div
            style={{
              position: "relative",
              width: ocarinaW,
              justifySelf: "center",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <OcarinaSvg
              fingering={ev.fingering}
              width={ocarinaW}
              showLabels={false}
            />
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
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: specialGlyphFont,
                    textAlign: "center",
                    lineHeight: 1,
                    color: "rgba(255,255,255,0.9)",
                    userSelect: "none",
                  }}
                >
                  —
                </div>
                {editable ? (
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
                ) : null}
              </>
            ) : invisibleSpaces ? null : (
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
                    width: ocarinaW,
                    height: ocarinaW,
                    position: "relative",
                    border: selected
                      ? "2px solid rgba(255,255,255,0.6)"
                      : "2px dashed rgba(255,255,255,0.35)",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: Math.max(10, Math.round(12 * s)),
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  <div>Espacio</div>
                  {editable ? (
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
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}
        {isBreak && (
          <>
            {compact ? (
              <>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: specialGlyphFont,
                    textAlign: "center",
                    lineHeight: 1,
                    color: "rgba(255,255,255,0.9)",
                    userSelect: "none",
                  }}
                >
                  ↵
                </div>
                {editable ? (
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
                ) : null}
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
                    width: ocarinaW,
                    height: ocarinaW,
                    position: "relative",
                    border: selected
                      ? "2px solid rgba(255,255,255,0.6)"
                      : "2px dashed rgba(255,255,255,0.35)",
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
                  {editable ? (
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
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
    <div
      ref={grid.ref}
      style={{
        display: "grid",
        gap,
        gridTemplateColumns: lineBreaksAsNewline ? `repeat(${effectiveCols}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
        alignItems: "start",
      }}
    >
      {(lineBreaksAsNewline && !compact
        ? (() => {
            const out: React.ReactNode[] = [];
            let col = 0;
            for (let idx = 0; idx < song.length; idx++) {
              const ev = song[idx];
              const isBreak = ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO";
              if (isBreak) {
                const rem = col % effectiveCols;
                if (rem !== 0) {
                  const fill = effectiveCols - rem;
                  for (let i = 0; i < fill; i++) {
                    out.push(
                      <div
                        key={`br-ph-${ev.id}-${i}`}
                        style={{
                          visibility: "hidden",
                          pointerEvents: "none",
                          aspectRatio: forceSquare ? "1 / 1" : undefined,
                          padding: pad,
                          borderRadius: radius,
                          boxSizing: "border-box",
                        }}
                      />
                    );
                    col++;
                  }
                }
                col = 0;
                continue; // salto real: no renderizar nada
              }
              out.push(renderCell(ev, idx));
              col++;
            }
            return out;
          })()
        : song.map((ev, idx) => renderCell(ev, idx)))}
      {/* Zona de drop para insertar al final */}
      {editable && song.length > 0 && (
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
    {song.length === 0 && !!emptyText && (
      <div style={{ opacity: 0.7 }}>{emptyText}</div>
    )}
    </>
  );
}
