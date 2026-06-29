"use client";

import React from "react";

export default function MidiImportModal({
  open,
  fileName,
  warnings,
  hasExistingContent,
  onCancel,
  onReplace,
  onNewSection,
}: {
  open: boolean;
  fileName: string;
  warnings: string[];
  hasExistingContent: boolean;
  onCancel: () => void;
  onReplace: () => void;
  onNewSection: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1160,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
      }}
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 480px)",
          background: "#1f1f1f",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Importar MIDI</div>
          <button
            onClick={onCancel}
            style={{ marginLeft: "auto", background: "none", color: "#eaeaea", border: "none", fontSize: 18, cursor: "pointer" }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: 13, opacity: 0.9 }}>
          Archivo: <strong>{fileName}</strong>
        </div>

        {warnings.length > 0 ? (
          <div
            style={{
              fontSize: 12,
              opacity: 0.85,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(255, 180, 60, 0.12)",
              border: "1px solid rgba(255, 180, 60, 0.25)",
              whiteSpace: "pre-line",
            }}
          >
            {warnings.join("\n")}
          </div>
        ) : null}

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          ¿Dónde querés colocar las notas importadas?
        </div>

        {hasExistingContent ? (
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            La canción actual tiene contenido. Reemplazar borrará las secciones y voces actuales.
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onReplace}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: hasExistingContent ? "rgba(160, 50, 50, 0.35)" : "#2a2a2a",
              color: "#eaeaea",
              cursor: "pointer",
              fontWeight: 700,
              textAlign: "left",
            }}
          >
            Reemplazar canción actual
          </button>
          <button
            onClick={onNewSection}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(120, 180, 255, 0.35)",
              background: "rgba(40, 70, 110, 0.45)",
              color: "#dce8ff",
              cursor: "pointer",
              fontWeight: 700,
              textAlign: "left",
            }}
          >
            Agregar como sección nueva
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#1f1f1f",
              color: "#eaeaea",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
