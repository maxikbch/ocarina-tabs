"use client";

import React, { useEffect, useRef, useState } from "react";
import { Save, X } from "lucide-react";
import { IconLabel, ModalCloseButton } from "@/components/icons";
import type { SectionColorIndex } from "@/lib/songDocV2";
import { SECTION_MARKER_COLORS } from "@/lib/sectionMarkers";

const COLOR_OPTIONS: SectionColorIndex[] = [0, 1, 2, 3, 4, 5, 6];

export default function SectionEditModal({
  open,
  initialName = "",
  initialColor = 0,
  onCancel,
  onSave,
}: {
  open: boolean;
  initialName?: string;
  initialColor?: SectionColorIndex;
  onCancel: () => void;
  onSave: (name: string, color: SectionColorIndex) => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<SectionColorIndex>(initialColor);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setColor(initialColor);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, initialName, initialColor]);

  if (!open) return null;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color);
  }

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
      aria-labelledby="section-edit-title"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 400px)",
          background: "#1f1f1f",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div id="section-edit-title" style={{ fontWeight: 900, fontSize: 16 }}>
            Editar sección
          </div>
          <ModalCloseButton onClick={onCancel} />
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
          Nombre
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la sección"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onCancel();
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#111",
              color: "#eaeaea",
            }}
            aria-label="Nombre de la sección"
          />
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Color</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {COLOR_OPTIONS.map((idx) => {
              const swatch = SECTION_MARKER_COLORS[idx];
              const selected = color === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setColor(idx)}
                  aria-label={`Color ${idx + 1}`}
                  title={`Color ${idx + 1}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: selected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.2)",
                    background: swatch,
                    cursor: "pointer",
                    boxShadow: selected ? `0 0 10px ${swatch}` : undefined,
                    padding: 0,
                  }}
                />
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "transparent",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <IconLabel icon={X}>Cancelar</IconLabel>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: name.trim() ? "#2b7a1f" : "rgba(43,122,31,0.4)",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: name.trim() ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <IconLabel icon={Save}>Guardar</IconLabel>
          </button>
        </div>
      </div>
    </div>
  );
}
