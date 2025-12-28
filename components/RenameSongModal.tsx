"use client";

import React, { useEffect, useRef, useState } from "react";

export default function RenameSongModal({
  open,
  initialName = "",
  onCancel,
  onSave,
}: {
  open: boolean;
  initialName?: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, initialName]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
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
          width: "min(92vw, 440px)",
          background: "#1f1f1f",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Renombrar canción</div>
          <button
            onClick={onCancel}
            style={{ marginLeft: "auto", background: "none", color: "#eaeaea", border: "none", fontSize: 18, cursor: "pointer" }}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
          Nombre
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la canción"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const trimmed = (name || "").trim();
                if (trimmed) onSave(trimmed);
              }
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#111",
              color: "#eaeaea",
            }}
            aria-label="Nombre de la canción"
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button
            onClick={onCancel}
            style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              const trimmed = (name || "").trim();
              if (trimmed) onSave(trimmed);
            }}
            style={{ padding: "8px 12px", borderRadius: 10, background: "#2b7a1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}


