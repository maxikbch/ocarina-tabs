"use client";

import React, { useEffect, useRef, useState } from "react";

export default function SaveSongModal({
  open,
  initialName = "",
  categories = [],
  initialCategory = "",
  initialSubcategory = "",
  onCancel,
  onSave,
}: {
  open: boolean;
  initialName?: string;
  categories?: string[];
  initialCategory?: string;
  initialSubcategory?: string;
  onCancel: () => void;
  onSave: (name: string, category: string, subcategory: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [useNewCategory, setUseNewCategory] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setCategory(initialCategory || "");
      setSubcategory(initialSubcategory || "");
      setUseNewCategory(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, initialName, initialCategory, initialSubcategory]);

  function normalizeCategory(input: string): string {
    const trimmed = (input || "").trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    const match = (categories || []).find((c) => c.toLowerCase() === lower);
    return match ?? trimmed;
  }
  function getFinalCategory(): string {
    if (useNewCategory) return normalizeCategory(category);
    return (category || "").trim();
  }

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
          <div style={{ fontWeight: 900, fontSize: 16 }}>Guardar canción</div>
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
                if (trimmed) onSave(trimmed, normalizeCategory(category), (subcategory || "").trim());
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
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Categoría (opcional)</div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, userSelect: "none", marginLeft: "auto" }}>
              <input
                type="checkbox"
                checked={useNewCategory}
                onChange={(e) => {
                  setUseNewCategory(e.target.checked);
                  setCategory("");
                }}
                aria-label="Usar nueva categoría"
                title="Usar nueva categoría"
              />
              Nueva categoría
            </label>
          </div>
          {useNewCategory ? (
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Escribe la nueva categoría"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "#111",
                color: "#eaeaea",
              }}
              aria-label="Nueva categoría"
            />
          ) : (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "#111",
                color: "#eaeaea",
              }}
              aria-label="Seleccionar categoría existente"
            >
              <option value="">Sin categoría</option>
              {(categories || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
          Subcategoría (opcional)
          <input
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            placeholder="Ej: Zelda / Pop / Práctica"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#111",
              color: "#eaeaea",
            }}
            aria-label="Subcategoría"
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
              if (trimmed) onSave(trimmed, getFinalCategory(), (subcategory || "").trim());
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


