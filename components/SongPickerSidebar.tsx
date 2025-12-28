"use client";

import React, { useMemo, useState } from "react";

export type SongRef = { name: string; category: string };

export default function SongPickerSidebar({
  open,
  songs,
  onClose,
  onPick,
}: {
  open: boolean;
  songs: SongRef[];
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [allMode, setAllMode] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);

  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("ocarina.ui.songPicker.allMode") : null;
      if (raw === "1") setAllMode(true);
      if (raw === "0") setAllMode(false);
    } catch {}
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of songs) {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    const hasUncategorized = songs.some((s) => !(s.category && s.category.trim()));
    if (hasUncategorized) arr.push("Otros");
    return arr;
  }, [songs]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredAll = useMemo(() => {
    const arr = normalizedQuery
      ? songs.filter(
          (s) =>
            s.name.toLowerCase().includes(normalizedQuery) ||
            (s.category || "").toLowerCase().includes(normalizedQuery)
        )
      : songs;
    return arr.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [songs, normalizedQuery]);

  const filteredCategories = useMemo(() => {
    const arr = normalizedQuery
      ? categories.filter(
          (c) =>
            c.toLowerCase().includes(normalizedQuery) ||
            (c === "Otros"
              ? songs.some((s) => (s.category || "") === "" && s.name.toLowerCase().includes(normalizedQuery))
              : songs.some((s) => s.category === c && s.name.toLowerCase().includes(normalizedQuery)))
        )
      : categories;
    return arr;
  }, [categories, songs, normalizedQuery]);

  const filteredSongsInCategory = useMemo(() => {
    const list = songs.filter((s) => s.category === (currentCategory || ""));
    const arr = normalizedQuery
      ? list.filter((s) => s.name.toLowerCase().includes(normalizedQuery))
      : list;
    return arr.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [songs, currentCategory, normalizedQuery]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
        background: "rgba(0,0,0,0.35)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 360,
          maxWidth: "100%",
          height: "100%",
          background: "#1f1f1f",
          borderLeft: "1px solid rgba(255,255,255,0.12)",
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontWeight: 900 }}>Seleccionar canción</div>
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", color: "#eaeaea", border: "none", fontSize: 18, cursor: "pointer" }}
            aria-label="Cerrar selector"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por canción o categoría…"
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#111",
              color: "#eaeaea",
            }}
            aria-label="Buscar"
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, userSelect: "none" }}>
            <input
              type="checkbox"
              checked={allMode}
              onChange={(e) => {
                setAllMode(e.target.checked);
                setCurrentCategory(null);
                try {
                  if (typeof window !== "undefined") localStorage.setItem("ocarina.ui.songPicker.allMode", e.target.checked ? "1" : "0");
                } catch {}
              }}
              aria-label="Mostrar todas las canciones"
              title="Mostrar todas las canciones"
            />
            All
          </label>
        </div>
        <div
          style={{
            overflow: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "stretch",
          }}
        >
          {allMode ? (
            filteredAll.length === 0 ? (
              <div style={{ opacity: 0.6 }}>Sin resultados.</div>
            ) : (
              filteredAll.map((s) => (
                <button
                  key={s.name}
                  onClick={() => {
                    onPick(s.name);
                    onClose();
                  }}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#2a2a2a",
                    color: "#eaeaea",
                    cursor: "pointer",
                    height: 56,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                  }}
                  title={s.category ? `Categoría: ${s.category}` : "Sin categoría"}
                >
                  <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                    {s.category || "Sin categoría"}
                  </div>
                </button>
              ))
            )
          ) : currentCategory == null ? (
            filteredCategories.length === 0 ? (
              <div style={{ opacity: 0.6 }}>No hay categorías.</div>
            ) : (
              filteredCategories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrentCategory(c === "Otros" ? "" : c)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#2a2a2a",
                    color: "#eaeaea",
                    cursor: "pointer",
                    height: 56,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {c}
                </button>
              ))
            )
          ) : (
            <>
              <button
                onClick={() => setCurrentCategory(null)}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#2a2a2a",
                  color: "#eaeaea",
                  cursor: "pointer",
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                ← Volver a categorías
              </button>
              {filteredSongsInCategory.length === 0 ? (
                <div style={{ opacity: 0.6 }}>Sin canciones en esta categoría.</div>
              ) : (
                filteredSongsInCategory.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      onPick(s.name);
                      onClose();
                    }}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "#2a2a2a",
                      color: "#eaeaea",
                      cursor: "pointer",
                      height: 56,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                      {s.category || "Sin categoría"}
                    </div>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


