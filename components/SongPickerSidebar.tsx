"use client";

import React, { useMemo, useState } from "react";

export type SongRef = { name: string; category: string; subcategory: string };

type BrowseMode = "cat_subcat" | "cat" | "subcat" | "all";
type SortField = "name" | "subcategory";
type SortDir = "asc" | "desc";

export default function SongPickerSidebar({
  open,
  songs,
  onClose,
  onPick,
}: {
  open: boolean;
  songs: SongRef[];
  onClose: () => void;
  onPick: (name: string) => boolean | Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("cat_subcat");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [currentSubcategory, setCurrentSubcategory] = useState<string | null>(null);

  React.useEffect(() => {
    try {
      const rawMode = typeof window !== "undefined" ? localStorage.getItem("ocarina.ui.songPicker.browseMode") : null;
      if (rawMode === "cat_subcat" || rawMode === "cat" || rawMode === "subcat" || rawMode === "all") setBrowseMode(rawMode);
      const rawSortField = typeof window !== "undefined" ? localStorage.getItem("ocarina.ui.songPicker.sortField") : null;
      if (rawSortField === "name" || rawSortField === "subcategory") setSortField(rawSortField);
      const rawSortDir = typeof window !== "undefined" ? localStorage.getItem("ocarina.ui.songPicker.sortDir") : null;
      if (rawSortDir === "asc" || rawSortDir === "desc") setSortDir(rawSortDir);
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

  function matchesQuery(s: SongRef, q: string): boolean {
    if (!q) return true;
    const name = (s.name || "").toLowerCase();
    const sub = (s.subcategory || "").toLowerCase();
    return name.includes(q) || sub.includes(q);
  }

  const subSortKey = (s: SongRef) => ((s.subcategory || "").trim() || (s.category || "").trim() || "Sin categoría").toLowerCase();
  const nameSortKey = (s: SongRef) => (s.name || "").toLowerCase();
  const cmp = (a: SongRef, b: SongRef) => {
    // Nota: por UI/UX pedida, "ascendente" = Z→A y "descendente" = A→Z
    const dir = sortDir === "asc" ? -1 : 1;
    if (sortField === "subcategory") {
      const ka = subSortKey(a);
      const kb = subSortKey(b);
      const d = ka.localeCompare(kb);
      if (d !== 0) return d * dir;
    }
    return a.name.localeCompare(b.name) * dir;
  };

  // “Todas” implícito: si hay query y estás en el nivel raíz => mostrar canciones directo
  const effectiveSongListAtRoot = !!normalizedQuery && currentCategory == null && currentSubcategory == null;

  const filteredAll = useMemo(() => {
    const arr = normalizedQuery ? songs.filter((s) => matchesQuery(s, normalizedQuery)) : songs;
    return arr.slice().sort(cmp);
  }, [songs, normalizedQuery, sortField, sortDir]);

  const filteredCategories = useMemo(() => {
    const base = categories;
    if (!normalizedQuery) return base;
    return base.filter((c) => {
      const cat = c === "Otros" ? "" : c;
      return songs.filter((s) => (s.category || "") === cat).some((s) => matchesQuery(s, normalizedQuery));
    });
  }, [categories, songs, normalizedQuery]);

  const allSubcategories = useMemo(() => {
    const set = new Set<string>();
    let hasEmpty = false;
    for (const s of songs) {
      const sub = (s.subcategory || "").trim();
      if (!sub) {
        hasEmpty = true;
        continue;
      }
      set.add(sub);
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (hasEmpty) arr.push("Sin subcategoría");
    return arr;
  }, [songs]);

  const filteredSubcategories = useMemo(() => {
    if (!normalizedQuery) return allSubcategories;
    // buscar por canciones que matcheen query dentro de esa subcat
    return allSubcategories.filter((sub) => {
      const subVal = sub === "Sin subcategoría" ? "" : sub;
      return songs.filter((s) => (s.subcategory || "").trim() === subVal).some((s) => matchesQuery(s, normalizedQuery));
    });
  }, [allSubcategories, songs, normalizedQuery]);

  const subcategoriesInCategory = useMemo(() => {
    if (currentCategory == null) return [];
    const cat = currentCategory || "";
    const set = new Set<string>();
    let hasEmpty = false;
    for (const s of songs) {
      if ((s.category || "") !== cat) continue;
      const sub = (s.subcategory || "").trim();
      if (!sub) {
        hasEmpty = true;
        continue;
      }
      set.add(sub);
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (hasEmpty) arr.push("Sin subcategoría");
    return arr;
  }, [songs, currentCategory]);

  const filteredSubcategoriesInCategory = useMemo(() => {
    if (currentCategory == null) return [];
    if (!normalizedQuery) return subcategoriesInCategory;
    const cat = currentCategory || "";
    return subcategoriesInCategory.filter((sc) => {
      const subVal = sc === "Sin subcategoría" ? "" : sc;
      return songs
        .filter((s) => (s.category || "") === cat && (s.subcategory || "").trim() === (subVal || "").trim())
        .some((s) => matchesQuery(s, normalizedQuery));
    });
  }, [songs, currentCategory, subcategoriesInCategory, normalizedQuery]);

  const filteredSongsInCategory = useMemo(() => {
    const list = songs.filter((s) => s.category === (currentCategory || ""));
    const arr = normalizedQuery ? list.filter((s) => matchesQuery(s, normalizedQuery)) : list;
    return arr.slice().sort(cmp);
  }, [songs, currentCategory, normalizedQuery, sortField, sortDir]);

  const filteredSongsInSubcategory = useMemo(() => {
    const subVal = (currentSubcategory || "") === "Sin subcategoría" ? "" : (currentSubcategory || "");
    const list = songs.filter((s) => (s.subcategory || "").trim() === subVal);
    const arr = normalizedQuery ? list.filter((s) => matchesQuery(s, normalizedQuery)) : list;
    return arr.slice().sort(cmp);
  }, [songs, currentSubcategory, normalizedQuery, sortField, sortDir]);

  const filteredSongsInCatSubcat = useMemo(() => {
    if (currentCategory == null || currentSubcategory == null) return [];
    const cat = currentCategory || "";
    const subVal = currentSubcategory === "Sin subcategoría" ? "" : currentSubcategory;
    const list = songs.filter((s) => (s.category || "") === cat && (s.subcategory || "").trim() === (subVal || "").trim());
    const arr = normalizedQuery ? list.filter((s) => matchesQuery(s, normalizedQuery)) : list;
    return arr.slice().sort(cmp);
  }, [songs, currentCategory, currentSubcategory, normalizedQuery, sortField, sortDir]);

  if (!open) return null;

  const secondaryLabel = (s: SongRef): string => {
    const sub = (s.subcategory || "").trim();
    if (sub) return sub;
    const cat = (s.category || "").trim();
    if (cat) return cat;
    return "Sin categoría";
  };

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
          gridTemplateRows: "auto auto auto 1fr",
          minHeight: 0,
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
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: 12,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            minWidth: 0,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por canción o subcategoría…"
            style={{
              flex: 1,
              minWidth: 0,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#111",
              color: "#eaeaea",
            }}
            aria-label="Buscar"
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "10px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            minWidth: 0,
          }}
        >
          <select
            value={browseMode}
            onChange={(e) => {
              const next = e.target.value as BrowseMode;
              setBrowseMode(next);
              setCurrentCategory(null);
              setCurrentSubcategory(null);
              try {
                if (typeof window !== "undefined") localStorage.setItem("ocarina.ui.songPicker.browseMode", next);
              } catch {}
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#111",
              color: "#eaeaea",
              flex: 1,
              minWidth: 0,
            }}
            aria-label="Modo de navegación"
            title="Modo de navegación"
          >
            <option value="cat_subcat">Categorías/Subcategorías</option>
            <option value="cat">Categorías</option>
            <option value="subcat">Subcategorías</option>
            <option value="all">Canciones</option>
          </select>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <button
              onClick={() => {
                if (sortField === "name") {
                  const nextDir: SortDir = sortDir === "desc" ? "asc" : "desc";
                  setSortDir(nextDir);
                  try {
                    if (typeof window !== "undefined") localStorage.setItem("ocarina.ui.songPicker.sortDir", nextDir);
                  } catch {}
                  return;
                }
                const next: SortField = "name";
                setSortField(next);
                setSortDir("desc");
                try {
                  if (typeof window !== "undefined") localStorage.setItem("ocarina.ui.songPicker.sortField", next);
                  if (typeof window !== "undefined") localStorage.setItem("ocarina.ui.songPicker.sortDir", "desc");
                } catch {}
              }}
              style={{
                padding: "8px 8px",
                borderRadius: 10,
                border: sortField === "name" ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.15)",
                background: "#111",
                color: "#eaeaea",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
              aria-label="Ordenar por Nombre"
              title={sortField === "name" ? "Nombre (clic para alternar asc/desc)" : "Ordenar por Nombre"}
            >
              Nombre {sortField === "name" ? (sortDir === "asc" ? "▲" : "▼") : "◆"}
            </button>
            <button
              onClick={() => {
                if (sortField === "subcategory") {
                  const nextDir: SortDir = sortDir === "desc" ? "asc" : "desc";
                  setSortDir(nextDir);
                  try {
                    if (typeof window !== "undefined") localStorage.setItem("ocarina.ui.songPicker.sortDir", nextDir);
                  } catch {}
                  return;
                }
                const next: SortField = "subcategory";
                setSortField(next);
                setSortDir("desc");
                try {
                  if (typeof window !== "undefined") localStorage.setItem("ocarina.ui.songPicker.sortField", next);
                  if (typeof window !== "undefined") localStorage.setItem("ocarina.ui.songPicker.sortDir", "desc");
                } catch {}
              }}
              style={{
                padding: "8px 8px",
                borderRadius: 10,
                border: sortField === "subcategory" ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.15)",
                background: "#111",
                color: "#eaeaea",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
              aria-label="Ordenar por Subcategoría"
              title={sortField === "subcategory" ? "Subcategoría (clic para alternar asc/desc)" : "Ordenar por Subcategoría"}
            >
              Subcat {sortField === "subcategory" ? (sortDir === "asc" ? "▲" : "▼") : "◆"}
            </button>
          </div>
        </div>
        <div
          style={{
            overflow: "auto",
            padding: 12,
            display: "grid",
            gridAutoRows: "min-content",
            gap: 8,
            alignItems: "stretch",
            minHeight: 0,
            alignContent: "start",
          }}
        >
          {effectiveSongListAtRoot || browseMode === "all" ? (
            filteredAll.length === 0 ? (
              <div style={{ opacity: 0.6 }}>Sin resultados.</div>
            ) : (
              filteredAll.map((s) => (
                <button
                  key={s.name}
                  onClick={async () => {
                    await onPick(s.name);
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
                  title={(s.subcategory || "").trim() ? `Subcategoría: ${s.subcategory}` : (s.category || "").trim() ? `Categoría: ${s.category}` : "Sin categoría"}
                >
                  <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                    {secondaryLabel(s)}
                  </div>
                </button>
              ))
            )
          ) : browseMode === "cat" ? (
            currentCategory == null ? (
              filteredCategories.length === 0 ? (
                <div style={{ opacity: 0.6 }}>No hay categorías.</div>
              ) : (
                filteredCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCurrentCategory(c === "Otros" ? "" : c);
                      setCurrentSubcategory(null);
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
                    padding: "7px 11px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#2a2a2a",
                    color: "#eaeaea",
                    cursor: "pointer",
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  ← Volver
                </button>
                {filteredSongsInCategory.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>Sin canciones en esta categoría.</div>
                ) : (
                  filteredSongsInCategory.map((s) => (
                    <button
                      key={s.name}
                      onClick={async () => {
                        await onPick(s.name);
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
                        {secondaryLabel(s)}
                      </div>
                    </button>
                  ))
                )}
              </>
            )
          ) : browseMode === "subcat" ? (
            currentSubcategory == null ? (
              filteredSubcategories.length === 0 ? (
                <div style={{ opacity: 0.6 }}>No hay subcategorías.</div>
              ) : (
                filteredSubcategories.map((sc) => (
                  <button
                    key={sc}
                    onClick={() => {
                      setCurrentSubcategory(sc);
                      setCurrentCategory(null);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "7px 11px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "#2a2a2a",
                      color: "#eaeaea",
                      cursor: "pointer",
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                    title={sc}
                  >
                    {sc}
                  </button>
                ))
              )
            ) : (
              <>
                <button
                  onClick={() => setCurrentSubcategory(null)}
                  style={{
                    textAlign: "left",
                    padding: "7px 11px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#2a2a2a",
                    color: "#eaeaea",
                    cursor: "pointer",
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  ← Volver
                </button>
                {filteredSongsInSubcategory.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>Sin canciones en esta subcategoría.</div>
                ) : (
                  filteredSongsInSubcategory.map((s) => (
                    <button
                      key={s.name}
                      onClick={async () => {
                        await onPick(s.name);
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
                        {secondaryLabel(s)}
                      </div>
                    </button>
                  ))
                )}
              </>
            )
          ) : (
            // cat_subcat
            currentCategory == null ? (
              filteredCategories.length === 0 ? (
                <div style={{ opacity: 0.6 }}>No hay categorías.</div>
              ) : (
                filteredCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCurrentCategory(c === "Otros" ? "" : c);
                      setCurrentSubcategory(null);
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
            ) : currentSubcategory == null ? (
              <>
                <button
                  onClick={() => setCurrentCategory(null)}
                  style={{
                    textAlign: "left",
                    padding: "7px 11px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#2a2a2a",
                    color: "#eaeaea",
                    cursor: "pointer",
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  ← Volver
                </button>
                {normalizedQuery ? (
                  filteredSongsInCategory.length === 0 ? (
                    <div style={{ opacity: 0.6 }}>Sin resultados en esta categoría.</div>
                  ) : (
                    filteredSongsInCategory.map((s) => (
                      <button
                        key={s.name}
                        onClick={async () => {
                          await onPick(s.name);
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
                          {secondaryLabel(s)}
                        </div>
                      </button>
                    ))
                  )
                ) : filteredSubcategoriesInCategory.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>Sin subcategorías en esta categoría.</div>
                ) : (
                  filteredSubcategoriesInCategory.map((sc) => (
                    <button
                      key={sc}
                      onClick={() => setCurrentSubcategory(sc)}
                      style={{
                        textAlign: "left",
                        padding: "7px 11px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "#2a2a2a",
                        color: "#eaeaea",
                        cursor: "pointer",
                        height: 48,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                      title={sc}
                    >
                      {sc}
                    </button>
                  ))
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentSubcategory(null)}
                  style={{
                    textAlign: "left",
                    padding: "7px 11px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#2a2a2a",
                    color: "#eaeaea",
                    cursor: "pointer",
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  ← Volver
                </button>
                {filteredSongsInCatSubcat.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>Sin canciones en esta subcategoría.</div>
                ) : (
                  filteredSongsInCatSubcat.map((s) => (
                    <button
                      key={s.name}
                      onClick={async () => {
                        await onPick(s.name);
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
                        {secondaryLabel(s)}
                      </div>
                    </button>
                  ))
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}


