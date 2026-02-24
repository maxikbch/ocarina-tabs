"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { downloadBundleForNames, makeSongShareCode } from "@/lib/songStore";

export type CompendiumSongRef = { name: string; category: string; subcategory: string };

type BrowseMode = "cat_subcat" | "cat" | "subcat" | "all";
type SortField = "name" | "subcategory";
type SortDir = "asc" | "desc";

export default function CompendiumManager({
  songs,
  categories,
  onRefresh,
  hasSong,
  onExportAll,
  onImportFile,
  onImportSongCode,
  onClearAll,
  onDeleteSong,
  onDeleteCategory,
  onDeleteSubcategory,
  renameCategory,
  renameSubcategory,
  renameSong,
  setSongCategory,
  setSongSubcategory,
  askConfirm,
  showToast,
}: {
  songs: CompendiumSongRef[];
  categories: string[];
  onRefresh: () => void;
  hasSong: (name: string) => boolean;
  onExportAll: () => void | Promise<void>;
  onImportFile: (file: File) => void | Promise<void>;
  onImportSongCode: (code: string) => void | Promise<void>;
  onClearAll: () => void | Promise<void>;
  onDeleteSong: (name: string) => void | Promise<void>;
  onDeleteCategory: (name: string) => void | Promise<void>;
  onDeleteSubcategory: (name: string) => void | Promise<void>;
  renameCategory: (oldName: string, newName: string) => void | Promise<void>;
  renameSubcategory: (oldName: string, newName: string) => void | Promise<void>;
  renameSong: (oldName: string, newName: string) => void | Promise<void>;
  setSongCategory: (name: string, category: string) => void | Promise<void>;
  setSongSubcategory: (name: string, subcategory: string) => void | Promise<void>;
  askConfirm: (message: string) => Promise<boolean>;
  showToast: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("cat_subcat");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [currentSubcategory, setCurrentSubcategory] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedSongName, setSelectedSongName] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const listCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of songs) {
      const c = (s.category || "").trim();
      if (c) set.add(c);
    }
    // también incorporamos las categorías conocidas por props
    for (const c of categories || []) {
      const t = (c || "").trim();
      if (t) set.add(t);
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    const hasUncategorized = songs.some((s) => !((s.category || "").trim()));
    if (hasUncategorized) arr.push("Otros");
    return arr;
  }, [songs, categories]);

  function matchesQuery(s: CompendiumSongRef, q: string): boolean {
    if (!q) return true;
    const name = (s.name || "").toLowerCase();
    const sub = (s.subcategory || "").toLowerCase();
    return name.includes(q) || sub.includes(q);
  }

  const subSortKey = (s: CompendiumSongRef) => ((s.subcategory || "").trim() || (s.category || "").trim() || "Sin categoría").toLowerCase();
  const cmp = (a: CompendiumSongRef, b: CompendiumSongRef) => {
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

  const effectiveSongListAtRoot = !!normalizedQuery && currentCategory == null && currentSubcategory == null;

  const filteredAllSongs = useMemo(() => {
    const arr = normalizedQuery ? songs.filter((s) => matchesQuery(s, normalizedQuery)) : songs;
    return arr.slice().sort(cmp);
  }, [songs, normalizedQuery, sortField, sortDir]);

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return listCategories;
    return listCategories.filter((c) => {
      const cat = c === "Otros" ? "" : c;
      return songs.filter((s) => (s.category || "") === cat).some((s) => matchesQuery(s, normalizedQuery));
    });
  }, [listCategories, songs, normalizedQuery]);

  const songsInCurrentCategory = useMemo(() => {
    const cat = currentCategory || "";
    const list = songs.filter((s) => (s.category || "") === cat);
    const arr = normalizedQuery ? list.filter((s) => matchesQuery(s, normalizedQuery)) : list;
    return arr.slice().sort(cmp);
  }, [songs, currentCategory, normalizedQuery, sortField, sortDir]);

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
    return allSubcategories.filter((sc) => {
      const val = sc === "Sin subcategoría" ? "" : sc;
      return songs.filter((s) => (s.subcategory || "").trim() === val).some((s) => matchesQuery(s, normalizedQuery));
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

  const songsInSubcategory = useMemo(() => {
    if (currentSubcategory == null) return [];
    const val = currentSubcategory === "Sin subcategoría" ? "" : currentSubcategory;
    const list = songs.filter((s) => (s.subcategory || "").trim() === (val || "").trim());
    const arr = normalizedQuery ? list.filter((s) => matchesQuery(s, normalizedQuery)) : list;
    return arr.slice().sort(cmp);
  }, [songs, currentSubcategory, normalizedQuery, sortField, sortDir]);

  const songsInCatSubcat = useMemo(() => {
    if (currentCategory == null || currentSubcategory == null) return [];
    const cat = currentCategory || "";
    const val = currentSubcategory === "Sin subcategoría" ? "" : currentSubcategory;
    const list = songs.filter((s) => (s.category || "") === cat && (s.subcategory || "").trim() === (val || "").trim());
    const arr = normalizedQuery ? list.filter((s) => matchesQuery(s, normalizedQuery)) : list;
    return arr.slice().sort(cmp);
  }, [songs, currentCategory, currentSubcategory, normalizedQuery, sortField, sortDir]);

  const secondaryLabel = (s: CompendiumSongRef): string => {
    const sub = (s.subcategory || "").trim();
    if (sub) return sub;
    const cat = (s.category || "").trim();
    if (cat) return cat;
    return "Sin categoría";
  };

  // Persistencia de modo/sort (similar al selector)
  useEffect(() => {
    try {
      const rawMode = typeof window !== "undefined" ? localStorage.getItem("ocarina.ui.songPicker.browseMode") : null;
      if (rawMode === "cat_subcat" || rawMode === "cat" || rawMode === "subcat" || rawMode === "all") setBrowseMode(rawMode);
      const rawSortField = typeof window !== "undefined" ? localStorage.getItem("ocarina.ui.songPicker.sortField") : null;
      if (rawSortField === "name" || rawSortField === "subcategory") setSortField(rawSortField);
      const rawSortDir = typeof window !== "undefined" ? localStorage.getItem("ocarina.ui.songPicker.sortDir") : null;
      if (rawSortDir === "asc" || rawSortDir === "desc") setSortDir(rawSortDir);
    } catch {}
  }, []);

  // ---- Editor: Categoría ----
  const [draftCategoryName, setDraftCategoryName] = useState("");
  useEffect(() => {
    if (!selectedCategory) {
      setDraftCategoryName("");
      return;
    }
    setDraftCategoryName(selectedCategory);
  }, [selectedCategory]);

  const isCategoryDirty = selectedCategory != null && draftCategoryName.trim() !== selectedCategory.trim();

  async function saveCategory() {
    if (!selectedCategory) return;
    const from = selectedCategory.trim();
    const to = draftCategoryName.trim();
    if (!from) return;
    if (to === from) return;

    const existing = listCategories.filter((c) => c !== "Otros");
    if (to && existing.includes(to)) {
      const ok = await askConfirm(`La categoría "${to}" ya existe.\n\n¿Querés fusionar "${from}" dentro de "${to}"?`);
      if (!ok) return;
    }

    await renameCategory(from, to);
    onRefresh();
    setSelectedCategory(to);
    showToast("Categoría actualizada");
  }

  // ---- Editor: Subcategoría ----
  const [draftSubcategoryName, setDraftSubcategoryName] = useState("");
  useEffect(() => {
    if (!selectedSubcategory) {
      setDraftSubcategoryName("");
      return;
    }
    setDraftSubcategoryName(selectedSubcategory);
  }, [selectedSubcategory]);

  const isSubcategoryDirty =
    selectedSubcategory != null &&
    selectedSubcategory !== "Sin subcategoría" &&
    draftSubcategoryName.trim() !== selectedSubcategory.trim();

  async function saveSubcategory() {
    if (!selectedSubcategory) return;
    if (selectedSubcategory === "Sin subcategoría") return;
    const from = selectedSubcategory.trim();
    const to = draftSubcategoryName.trim(); // permite "" => sin subcategoría
    if (!from) return;
    if (to === from) return;

    const existing = allSubcategories.filter((s) => s !== "Sin subcategoría");
    if (to && existing.includes(to)) {
      const ok = await askConfirm(`La subcategoría "${to}" ya existe.\n\n¿Querés fusionar "${from}" dentro de "${to}"?`);
      if (!ok) return;
    }

    await renameSubcategory(from, to);
    onRefresh();
    setSelectedSubcategory(to ? to : null);
    showToast("Subcategoría actualizada");
  }

  // ---- Editor: Canción ----
  const selectedSong = useMemo(() => {
    if (!selectedSongName) return null;
    return songs.find((s) => s.name === selectedSongName) || null;
  }, [songs, selectedSongName]);

  function sanitizeFilename(name: string): string {
    return (name || "").replace(/[<>:"/\\|?*\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim().replace(/\s/g, "_");
  }

  function makeStamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}_${hh}_${min}`;
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalDraftName, setExportModalDraftName] = useState("");
  const [exportModalNames, setExportModalNames] = useState<string[]>([]);
  const [exportModalContextLabel, setExportModalContextLabel] = useState<string>("");

  const exportInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!exportModalOpen) return;
    const id = window.setTimeout(() => exportInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [exportModalOpen]);

  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalValue, setCodeModalValue] = useState("");
  const [codeModalSongName, setCodeModalSongName] = useState("");
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importDragging, setImportDragging] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importScanError, setImportScanError] = useState<string>("");
  const [importScanInfo, setImportScanInfo] = useState<string>("");
  const [importingNow, setImportingNow] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [importSongModalOpen, setImportSongModalOpen] = useState(false);
  const [importSongCode, setImportSongCode] = useState("");
  const [importSongScanError, setImportSongScanError] = useState("");
  const [importSongBusy, setImportSongBusy] = useState(false);

  const importSongTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!importSongModalOpen) return;
    const id = window.setTimeout(() => {
      const el = importSongTextareaRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [importSongModalOpen]);

  function closeImportModal() {
    if (importingNow) return;
    setImportModalOpen(false);
    setImportDragging(false);
    setImportFile(null);
    setImportScanError("");
    setImportScanInfo("");
  }

  function closeImportSongModal() {
    if (importSongBusy) return;
    setImportSongModalOpen(false);
    setImportSongCode("");
    setImportSongScanError("");
  }

  const [deleteGroupModalOpen, setDeleteGroupModalOpen] = useState(false);
  const [deleteGroupKind, setDeleteGroupKind] = useState<"category" | "subcategory">("category");
  const [deleteGroupName, setDeleteGroupName] = useState("");
  const [deleteGroupInput, setDeleteGroupInput] = useState("");
  const [deleteGroupBusy, setDeleteGroupBusy] = useState(false);
  const deleteGroupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!deleteGroupModalOpen) return;
    const id = window.setTimeout(() => deleteGroupInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [deleteGroupModalOpen]);

  function openDeleteGroup(kind: "category" | "subcategory", name: string) {
    setDeleteGroupKind(kind);
    setDeleteGroupName(name);
    setDeleteGroupInput("");
    setDeleteGroupBusy(false);
    setDeleteGroupModalOpen(true);
  }

  function closeDeleteGroupModal() {
    if (deleteGroupBusy) return;
    setDeleteGroupModalOpen(false);
    setDeleteGroupKind("category");
    setDeleteGroupName("");
    setDeleteGroupInput("");
    setDeleteGroupBusy(false);
  }

  async function scanCompendiumFile(file: File): Promise<{ ok: boolean; error?: string; info?: string }> {
    const name = (file?.name || "").trim();
    const lower = name.toLowerCase();
    if (!lower.endsWith(".json")) return { ok: false, error: "El archivo debe ser .json" };
    if (file.size <= 0) return { ok: false, error: "El archivo está vacío." };

    let text = "";
    try {
      text = await file.text();
    } catch {
      return { ok: false, error: "No se pudo leer el archivo." };
    }
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "JSON inválido." };
    }
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "Formato inválido." };

    let songsAny: any = null;
    let versionLabel = "desconocida";
    if ("version" in parsed && "songs" in parsed) {
      versionLabel = String((parsed as any).version ?? "desconocida");
      songsAny = (parsed as any).songs;
    } else {
      songsAny = parsed;
    }

    if (!songsAny || typeof songsAny !== "object") return { ok: false, error: "El compendio no contiene canciones." };
    const count = Object.keys(songsAny).length;
    if (count <= 0) return { ok: false, error: "El compendio no contiene canciones." };

    return { ok: true, info: `Archivo válido. Versión: ${versionLabel}. Canciones: ${count}.` };
  }

  async function setImportCandidate(file: File) {
    setImportScanError("");
    setImportScanInfo("");
    setImportFile(null);
    const res = await scanCompendiumFile(file);
    if (!res.ok) {
      setImportScanError(res.error || "Archivo inválido.");
      return;
    }
    setImportFile(file);
    setImportScanInfo(res.info || "Archivo válido.");
  }

  useEffect(() => {
    if (!codeModalOpen) return;
    const id = window.setTimeout(() => {
      const el = codeTextareaRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [codeModalOpen]);

  function openExportModal(params: { names: string[]; defaultName: string; contextLabel: string }) {
    setExportModalNames(params.names);
    setExportModalDraftName(params.defaultName);
    setExportModalContextLabel(params.contextLabel);
    setExportModalOpen(true);
  }

  function closeExportModal() {
    setExportModalOpen(false);
    setExportModalDraftName("");
    setExportModalNames([]);
    setExportModalContextLabel("");
  }

  function closeCodeModal() {
    setCodeModalOpen(false);
    setCodeModalValue("");
    setCodeModalSongName("");
  }

  const [draftSongName, setDraftSongName] = useState("");
  const [draftSubcategory, setDraftSubcategory] = useState("");
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [draftCategory, setDraftCategory] = useState("");

  function normalizeCategory(input: string): string {
    const trimmed = (input || "").trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    const match = (categories || []).find((c) => c.toLowerCase() === lower);
    return match ?? trimmed;
  }

  useEffect(() => {
    if (!selectedSong) {
      setDraftSongName("");
      setDraftSubcategory("");
      setDraftCategory("");
      setUseNewCategory(false);
      return;
    }
    setDraftSongName(selectedSong.name || "");
    setDraftSubcategory(selectedSong.subcategory || "");
    setDraftCategory(selectedSong.category || "");
    setUseNewCategory(false);
  }, [selectedSong]);

  const finalDraftCategory = useNewCategory ? normalizeCategory(draftCategory) : (draftCategory || "").trim();

  const isSongDirty = (() => {
    if (!selectedSong) return false;
    if (draftSongName.trim() !== (selectedSong.name || "").trim()) return true;
    if (draftSubcategory.trim() !== (selectedSong.subcategory || "").trim()) return true;
    if (finalDraftCategory !== ((selectedSong.category || "").trim() || "")) return true;
    return false;
  })();

  async function saveSong() {
    if (!selectedSong) return;
    const fromName = (selectedSong.name || "").trim();
    const toName = draftSongName.trim();
    if (!toName) return;

    // Rename (con confirmación de overwrite)
    let effectiveName = fromName;
    if (toName !== fromName) {
      if (hasSong(toName)) {
        const ok = await askConfirm(`La canción "${toName}" ya existe.\n\n¿Sobrescribir?`);
        if (!ok) return;
      }
      await renameSong(fromName, toName);
      effectiveName = toName;
    }

    // Category/Subcategory updates
    const cat = finalDraftCategory;
    const sub = draftSubcategory.trim();
    await setSongCategory(effectiveName, cat);
    await setSongSubcategory(effectiveName, sub);

    onRefresh();
    setSelectedSongName(effectiveName);
    showToast("Canción actualizada");
  }

  const listRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      style={{
        marginTop: 0,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
        overflow: "hidden",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Lista izquierda */}
        <div
          style={{
            borderRight: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.10)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 14, opacity: 0.95 }}>Gestionar compendio</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
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
            <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
              <select
                value={browseMode}
                onChange={(e) => {
                  const next = e.target.value as BrowseMode;
                  setBrowseMode(next);
                  setCurrentCategory(null);
                  setCurrentSubcategory(null);
                  setSelectedCategory(null);
                  setSelectedSubcategory(null);
                  setSelectedSongName(null);
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

            {browseMode !== "all" && (currentCategory != null || currentSubcategory != null) ? (
              <button
                onClick={() => {
                  if (browseMode === "cat_subcat") {
                    if (currentSubcategory != null) setCurrentSubcategory(null);
                    else setCurrentCategory(null);
                    return;
                  }
                  if (browseMode === "cat") setCurrentCategory(null);
                  if (browseMode === "subcat") setCurrentSubcategory(null);
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
              >
                ← Volver
              </button>
            ) : null}
          </div>

          <div
            ref={listRef}
            style={{
              overflow: "auto",
              padding: 12,
              display: "grid",
              gridAutoRows: "min-content",
              gap: 8,
              alignItems: "stretch",
              flex: 1,
              minHeight: 0,
              alignContent: "start",
            }}
          >
            {effectiveSongListAtRoot || browseMode === "all" ? (
              filteredAllSongs.length === 0 ? (
                <div style={{ opacity: 0.6 }}>Sin resultados.</div>
              ) : (
                filteredAllSongs.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      setSelectedSongName(s.name);
                      setSelectedCategory(null);
                      setSelectedSubcategory(null);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: selectedSongName === s.name ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
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
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{s.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{secondaryLabel(s)}</div>
                  </button>
                ))
              )
            ) : browseMode === "cat" ? (
              currentCategory == null ? (
                filteredCategories.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>No hay categorías.</div>
                ) : (
                  filteredCategories.map((c) => {
                    const isSelected = selectedCategory === c;
                    const catValue = c === "Otros" ? "" : c;
                    return (
                      <div key={c} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        <button
                          onClick={() => {
                            if (c === "Otros") {
                              setSelectedCategory(null);
                              setSelectedSubcategory(null);
                              setSelectedSongName(null);
                              setCurrentCategory("");
                              return;
                            }
                            setSelectedCategory(c);
                            setSelectedSubcategory(null);
                            setSelectedSongName(null);
                          }}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: isSelected ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
                            background: "#2a2a2a",
                            color: "#eaeaea",
                            cursor: "pointer",
                            height: 52,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 15,
                            fontWeight: 800,
                            userSelect: "none",
                          }}
                          title={c === "Otros" ? "Canciones sin categoría" : `Categoría: ${c}`}
                        >
                          {c}
                        </button>
                        <button
                          onClick={() => {
                            setCurrentCategory(catValue);
                            setCurrentSubcategory(null);
                            setSelectedSongName(null);
                          }}
                          aria-label={c === "Otros" ? "Ver canciones sin categoría" : `Ver canciones de ${c}`}
                          title={c === "Otros" ? "Ver canciones sin categoría" : "Ver canciones"}
                          style={{
                            width: 44,
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "#2a2a2a",
                            color: "rgba(255,255,255,0.9)",
                            cursor: "pointer",
                            height: 52,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            lineHeight: 1,
                          }}
                        >
                          →
                        </button>
                      </div>
                    );
                  })
                )
              ) : songsInCurrentCategory.length === 0 ? (
                <div style={{ opacity: 0.6 }}>Sin canciones en esta categoría.</div>
              ) : (
                songsInCurrentCategory.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      setSelectedSongName(s.name);
                      setSelectedCategory(null);
                      setSelectedSubcategory(null);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: selectedSongName === s.name ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
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
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{s.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{secondaryLabel(s)}</div>
                  </button>
                ))
              )
            ) : browseMode === "subcat" ? (
              currentSubcategory == null ? (
                filteredSubcategories.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>No hay subcategorías.</div>
                ) : (
                  filteredSubcategories.map((sc) => {
                    const isSelected = selectedSubcategory === sc;
                    return (
                      <div key={sc} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        <button
                          onClick={() => {
                            if (sc === "Sin subcategoría") {
                              setSelectedSubcategory(null);
                              setSelectedCategory(null);
                              setSelectedSongName(null);
                              setCurrentSubcategory("Sin subcategoría");
                              return;
                            }
                            setSelectedSubcategory(sc);
                            setSelectedCategory(null);
                            setSelectedSongName(null);
                          }}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            padding: "7px 11px",
                            borderRadius: 10,
                            border: isSelected ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
                            background: "#2a2a2a",
                            color: "#eaeaea",
                            cursor: "pointer",
                            height: 48,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 800,
                            userSelect: "none",
                          }}
                          title={sc}
                        >
                          {sc}
                        </button>
                        <button
                          onClick={() => {
                            setCurrentSubcategory(sc);
                            setCurrentCategory(null);
                            setSelectedSongName(null);
                          }}
                          aria-label={`Ver canciones de ${sc}`}
                          title="Ver canciones"
                          style={{
                            width: 44,
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "#2a2a2a",
                            color: "rgba(255,255,255,0.9)",
                            cursor: "pointer",
                            height: 48,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            lineHeight: 1,
                          }}
                        >
                          →
                        </button>
                      </div>
                    );
                  })
                )
              ) : songsInSubcategory.length === 0 ? (
                <div style={{ opacity: 0.6 }}>Sin canciones en esta subcategoría.</div>
              ) : (
                songsInSubcategory.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      setSelectedSongName(s.name);
                      setSelectedCategory(null);
                      setSelectedSubcategory(null);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: selectedSongName === s.name ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
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
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{s.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{secondaryLabel(s)}</div>
                  </button>
                ))
              )
            ) : (
              // cat_subcat
              currentCategory == null ? (
                filteredCategories.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>No hay categorías.</div>
                ) : (
                  filteredCategories.map((c) => {
                    const isSelected = selectedCategory === c;
                    const catValue = c === "Otros" ? "" : c;
                    return (
                      <div key={c} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        <button
                          onClick={() => {
                            if (c === "Otros") {
                              setSelectedCategory(null);
                              setSelectedSubcategory(null);
                              setSelectedSongName(null);
                              setCurrentCategory("");
                              return;
                            }
                            setSelectedCategory(c);
                            setSelectedSubcategory(null);
                            setSelectedSongName(null);
                          }}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: isSelected ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
                            background: "#2a2a2a",
                            color: "#eaeaea",
                            cursor: "pointer",
                            height: 52,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 15,
                            fontWeight: 800,
                            userSelect: "none",
                          }}
                        >
                          {c}
                        </button>
                        <button
                          onClick={() => {
                            setCurrentCategory(catValue);
                            setCurrentSubcategory(null);
                            setSelectedSongName(null);
                          }}
                          aria-label={`Entrar a ${c}`}
                          title="Entrar"
                          style={{
                            width: 44,
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "#2a2a2a",
                            color: "rgba(255,255,255,0.9)",
                            cursor: "pointer",
                            height: 52,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            lineHeight: 1,
                          }}
                        >
                          →
                        </button>
                      </div>
                    );
                  })
                )
              ) : currentSubcategory == null ? (
                normalizedQuery ? (
                  songsInCurrentCategory.length === 0 ? (
                    <div style={{ opacity: 0.6 }}>Sin resultados en esta categoría.</div>
                  ) : (
                    songsInCurrentCategory.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => {
                          setSelectedSongName(s.name);
                          setSelectedCategory(null);
                          setSelectedSubcategory(null);
                        }}
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: selectedSongName === s.name ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
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
                        <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{s.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                          {secondaryLabel(s)}
                        </div>
                      </button>
                    ))
                  )
                ) : filteredSubcategoriesInCategory.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>Sin subcategorías en esta categoría.</div>
                ) : (
                  filteredSubcategoriesInCategory.map((sc) => {
                    const isSelected = selectedSubcategory === sc;
                    return (
                      <div key={sc} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        <button
                          onClick={() => {
                            if (sc === "Sin subcategoría") {
                              setSelectedSubcategory(null);
                              setSelectedCategory(null);
                              setSelectedSongName(null);
                              setCurrentSubcategory("Sin subcategoría");
                              return;
                            }
                            setSelectedSubcategory(sc);
                            setSelectedCategory(null);
                            setSelectedSongName(null);
                          }}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            padding: "7px 11px",
                            borderRadius: 10,
                            border: isSelected ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
                            background: "#2a2a2a",
                            color: "#eaeaea",
                            cursor: "pointer",
                            height: 48,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 800,
                            userSelect: "none",
                          }}
                        >
                          {sc}
                        </button>
                        <button
                          onClick={() => {
                            setCurrentSubcategory(sc);
                            setSelectedSongName(null);
                          }}
                          aria-label={`Ver canciones de ${sc}`}
                          title="Ver canciones"
                          style={{
                            width: 44,
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "#2a2a2a",
                            color: "rgba(255,255,255,0.9)",
                            cursor: "pointer",
                            height: 48,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            lineHeight: 1,
                          }}
                        >
                          →
                        </button>
                      </div>
                    );
                  })
                )
              ) : songsInCatSubcat.length === 0 ? (
                <div style={{ opacity: 0.6 }}>Sin canciones en esta subcategoría.</div>
              ) : (
                songsInCatSubcat.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      setSelectedSongName(s.name);
                      setSelectedCategory(null);
                      setSelectedSubcategory(null);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: selectedSongName === s.name ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.12)",
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
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{s.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{secondaryLabel(s)}</div>
                  </button>
                ))
              )
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div
          style={{
            padding: 14,
            display: "grid",
            gap: 12,
            alignContent: "start",
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.18)",
              padding: 12,
              display: "grid",
              gap: 12,
              alignContent: "start",
              boxSizing: "border-box",
              maxWidth: "100%",
              minWidth: 0,
              overflowX: "hidden",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 14, opacity: 0.95 }}>
              {selectedSong ? "Editar canción" : selectedSubcategory ? "Editar subcategoría" : selectedCategory ? "Editar categoría" : "Editar"}
            </div>

            {selectedCategory ? (
              <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                Nombre de categoría
                <input
                  value={draftCategoryName}
                  onChange={(e) => setDraftCategoryName(e.target.value)}
                  placeholder="Nombre"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "#111",
                    color: "#eaeaea",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                <button
                  onClick={() => openDeleteGroup("category", selectedCategory)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "#7a1f1f",
                    color: "#eaeaea",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                  }}
                  title="Borrar categoría y todas sus canciones"
                >
                  Borrar
                </button>
                <button
                  onClick={() => void saveCategory()}
                  disabled={!isCategoryDirty}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "#2b7a1f",
                    color: "#eaeaea",
                    border: "1px solid rgba(255,255,255,0.15)",
                    opacity: !isCategoryDirty ? 0.5 : 1,
                    cursor: !isCategoryDirty ? "not-allowed" : "pointer",
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
            ) : selectedSubcategory ? (
              <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  Nombre de subcategoría
                  <input
                    value={draftSubcategoryName}
                    onChange={(e) => setDraftSubcategoryName(e.target.value)}
                    placeholder="Nombre"
                    disabled={selectedSubcategory === "Sin subcategoría"}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "#111",
                      color: "#eaeaea",
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      opacity: selectedSubcategory === "Sin subcategoría" ? 0.6 : 1,
                    }}
                  />
                </label>
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <button
                    onClick={() => openDeleteGroup("subcategory", selectedSubcategory)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#7a1f1f",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.15)",
                      cursor: "pointer",
                    }}
                    title="Borrar subcategoría y todas sus canciones"
                  >
                    Borrar
                  </button>
                  <button
                    onClick={() => void saveSubcategory()}
                    disabled={!isSubcategoryDirty}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2b7a1f",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.15)",
                      opacity: !isSubcategoryDirty ? 0.5 : 1,
                      cursor: !isSubcategoryDirty ? "not-allowed" : "pointer",
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : selectedSong ? (
              <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                Nombre de la canción
                <input
                  value={draftSongName}
                  onChange={(e) => setDraftSongName(e.target.value)}
                  placeholder="Nombre"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "#111",
                    color: "#eaeaea",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
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
                        setDraftCategory("");
                      }}
                      aria-label="Usar nueva categoría"
                      title="Usar nueva categoría"
                    />
                    Nueva categoría
                  </label>
                </div>
                {useNewCategory ? (
                  <input
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    placeholder="Escribe la nueva categoría"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "#111",
                      color: "#eaeaea",
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    }}
                    aria-label="Nueva categoría"
                  />
                ) : (
                  <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "#111",
                      color: "#eaeaea",
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
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
                  value={draftSubcategory}
                  onChange={(e) => setDraftSubcategory(e.target.value)}
                  placeholder="Ej: Zelda / Pop / Práctica"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "#111",
                    color: "#eaeaea",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                <button
                  onClick={async () => {
                    if (!selectedSong) return;
                    const name = (selectedSong.name || "").trim();
                    if (!name) return;
                    const ok = await askConfirm(`¿Borrar la canción "${name}"?\n\nEsta acción no se puede deshacer.`);
                    if (!ok) return;
                    await onDeleteSong(name);
                    setSelectedSongName(null);
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "#7a1f1f",
                    color: "#eaeaea",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                  }}
                  title="Borrar canción"
                >
                  Borrar
                </button>
                <button
                  onClick={() => void saveSong()}
                  disabled={!isSongDirty || !draftSongName.trim()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "#2b7a1f",
                    color: "#eaeaea",
                    border: "1px solid rgba(255,255,255,0.15)",
                    opacity: !isSongDirty || !draftSongName.trim() ? 0.5 : 1,
                    cursor: !isSongDirty || !draftSongName.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
            ) : (
              <div style={{ opacity: 0.65, fontSize: 13 }}>
                Seleccioná una categoría para renombrarla o una canción para editar su nombre/categoría/subcategoría.
              </div>
            )}
          </div>

          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.18)",
              padding: 12,
              display: "grid",
              gap: 12,
              alignContent: "start",
              boxSizing: "border-box",
              maxWidth: "100%",
              minWidth: 0,
              overflowX: "hidden",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 14, opacity: 0.95 }}>Exportar</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 10,
                alignItems: "stretch",
              }}
            >
              {(() => {
                const stamp = makeStamp();
                const baseButton: React.CSSProperties = {
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "#111",
                  color: "#eaeaea",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  userSelect: "none",
                  fontSize: 14,
                  fontWeight: 950,
                };

                const disabledStyle: React.CSSProperties = { opacity: 0.45, cursor: "not-allowed" };
                const enabledStyle: React.CSSProperties = { cursor: "pointer" };

                const categoryLabel = selectedCategory || "";
                const categoryKey = categoryLabel === "Otros" ? "" : categoryLabel;
                const subLabel = selectedSubcategory || "";
                const subKey = subLabel === "Sin subcategoría" ? "" : subLabel;
                const songName = selectedSong?.name || "";

                const categoryNames = categoryLabel
                  ? songs.filter((s) => (s.category || "").trim() === (categoryKey || "").trim()).map((s) => s.name)
                  : [];
                const subNames = subLabel ? songs.filter((s) => (s.subcategory || "").trim() === (subKey || "").trim()).map((s) => s.name) : [];

                const canCategory = !!selectedCategory;
                const canSubcategory = !!selectedSubcategory;
                const canSong = !!selectedSong;

                const canCompendium = canCategory || canSubcategory || canSong;

                return (
                  <>
                    <button
                      disabled={!canCompendium}
                      onClick={() => {
                        if (!canCompendium) return;
                        if (canSong) {
                          const base = sanitizeFilename(songName) || "cancion";
                          const filename = `${base}_${stamp}.json`;
                          openExportModal({ names: [songName], defaultName: filename, contextLabel: songName });
                          return;
                        }
                        if (canSubcategory) {
                          const base = sanitizeFilename(subLabel) || "subcategoria";
                          const filename = `${base}_${stamp}.json`;
                          openExportModal({ names: subNames, defaultName: filename, contextLabel: subLabel });
                          return;
                        }
                        // category
                        const base = sanitizeFilename(categoryLabel) || "categoria";
                        const filename = `${base}_${stamp}.json`;
                        openExportModal({ names: categoryNames, defaultName: filename, contextLabel: categoryLabel });
                      }}
                      style={{ ...baseButton, ...(canCompendium ? enabledStyle : disabledStyle) }}
                      aria-label="Exportar compendio"
                      title={
                        canSong
                          ? "Exportar compendio de esta canción"
                          : canSubcategory
                            ? "Exportar compendio de esta subcategoría"
                            : canCategory
                              ? "Exportar compendio de esta categoría"
                              : "Seleccioná una categoría/subcategoría/canción para exportar"
                      }
                    >
                      Compendio
                    </button>

                    <button
                      disabled={!canSong}
                      onClick={async () => {
                        if (!canSong) return;
                        const code = await makeSongShareCode(songName);
                        if (!code) {
                          showToast("No se pudo generar el código.");
                          return;
                        }
                        setCodeModalValue(code);
                        setCodeModalSongName(songName);
                        setCodeModalOpen(true);
                      }}
                      style={{ ...baseButton, ...(canSong ? enabledStyle : disabledStyle) }}
                      aria-label="Copiar código comprimido"
                      title={canSong ? "Copiar código para compartir esta canción" : "Disponible solo para canciones"}
                    >
                      Codigo
                    </button>

                    <button
                      disabled={true}
                      onClick={() => {}}
                      style={{ ...baseButton, ...disabledStyle }}
                      aria-label="Exportar PDF (bloqueado)"
                      title="Exportar PDF (próximamente)"
                    >
                      PDF
                    </button>
                  </>
                );
              })()}
            </div>
          </div>

          {exportModalOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              onClick={closeExportModal}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 520,
                  maxWidth: "100%",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#1f1f1f",
                  padding: 14,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 950, fontSize: 14 }}>Descargar compendio</div>
                  <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {exportModalContextLabel}
                  </div>
                </div>

                <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  Nombre de archivo
                  <input
                    ref={exportInputRef}
                    value={exportModalDraftName}
                    onChange={(e) => setExportModalDraftName(e.target.value)}
                    placeholder="compendio.json"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "#111",
                      color: "#eaeaea",
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                  />
                </label>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={closeExportModal}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2a2a2a",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const raw = (exportModalDraftName || "").trim();
                      const example = exportModalDraftName || "compendio.json";
                      const chosen = sanitizeFilename(raw) || sanitizeFilename(example) || "compendio";
                      const finalName = chosen.toLowerCase().endsWith(".json") ? chosen : `${chosen}.json`;
                      downloadBundleForNames(exportModalNames, finalName);
                      showToast("Compendio exportado");
                      closeExportModal();
                    }}
                    disabled={!exportModalNames.length}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2b7a1f",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.15)",
                      opacity: !exportModalNames.length ? 0.5 : 1,
                      cursor: !exportModalNames.length ? "not-allowed" : "pointer",
                    }}
                  >
                    Descargar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {codeModalOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              onClick={closeCodeModal}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 680,
                  maxWidth: "100%",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#1f1f1f",
                  padding: 14,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 950, fontSize: 14 }}>Código comprimido</div>
                  <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {codeModalSongName}
                  </div>
                </div>

                <textarea
                  ref={codeTextareaRef}
                  value={codeModalValue}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    minHeight: 140,
                    resize: "vertical",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "#111",
                    color: "#eaeaea",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
                    fontSize: 12,
                    lineHeight: 1.35,
                  }}
                  aria-label="Código para compartir"
                />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={closeCodeModal}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2a2a2a",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: "pointer",
                    }}
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await copyToClipboard(codeModalValue);
                      showToast(ok ? "Código copiado" : "No se pudo copiar el código");
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2b7a1f",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.15)",
                      cursor: "pointer",
                    }}
                  >
                    Copiar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {importModalOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              onClick={closeImportModal}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 640,
                  maxWidth: "100%",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#1f1f1f",
                  padding: 14,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 14 }}>Importar compendio</div>

                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImportDragging(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImportDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImportDragging(false);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImportDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (!f) return;
                    await setImportCandidate(f);
                  }}
                  onClick={() => importFileInputRef.current?.click()}
                  style={{
                    borderRadius: 14,
                    border: importDragging ? "2px solid rgba(255,255,255,0.8)" : "1px dashed rgba(255,255,255,0.22)",
                    background: importDragging ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.20)",
                    padding: 16,
                    cursor: "pointer",
                    userSelect: "none",
                    display: "grid",
                    gap: 8,
                    alignContent: "start",
                  }}
                  title="Arrastrá y soltá un .json o clickeá para buscar"
                >
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Arrastrá y soltá tu compendio (.json)</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>O clickeá para seleccionar un archivo.</div>

                  {importFile ? (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                      <div style={{ fontWeight: 900 }}>{importFile.name}</div>
                      {importScanInfo ? <div style={{ opacity: 0.75 }}>{importScanInfo}</div> : null}
                    </div>
                  ) : null}

                  {importScanError ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,120,120,0.95)", fontWeight: 900 }}>{importScanError}</div>
                  ) : null}
                </div>

                <input
                  ref={importFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    await setImportCandidate(f);
                    // reset para permitir re-seleccionar el mismo archivo
                    e.currentTarget.value = "";
                  }}
                />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={closeImportModal}
                    disabled={importingNow}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2a2a2a",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: importingNow ? "not-allowed" : "pointer",
                      opacity: importingNow ? 0.6 : 1,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (!importFile) return;
                      setImportingNow(true);
                      try {
                        await onImportFile(importFile);
                        closeImportModal();
                      } finally {
                        setImportingNow(false);
                      }
                    }}
                    disabled={!importFile || importingNow}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2b7a1f",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.15)",
                      cursor: !importFile || importingNow ? "not-allowed" : "pointer",
                      opacity: !importFile || importingNow ? 0.5 : 1,
                    }}
                  >
                    Importar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {importSongModalOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              onClick={closeImportSongModal}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 720,
                  maxWidth: "100%",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#1f1f1f",
                  padding: 14,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 14 }}>Importar cancion</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Pegá el código generado en <span style={{ fontWeight: 900 }}>Codigo</span>. Se validará antes de importar.
                </div>

                <textarea
                  ref={importSongTextareaRef}
                  value={importSongCode}
                  onChange={(e) => {
                    setImportSongCode(e.target.value);
                    setImportSongScanError("");
                  }}
                  placeholder="OC6:... o OC6GZ:..."
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    minHeight: 140,
                    resize: "vertical",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "#111",
                    color: "#eaeaea",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
                    fontSize: 12,
                    lineHeight: 1.35,
                  }}
                  aria-label="Código de canción"
                />

                {importSongScanError ? (
                  <div style={{ fontSize: 12, color: "rgba(255,120,120,0.95)", fontWeight: 900 }}>{importSongScanError}</div>
                ) : null}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={closeImportSongModal}
                    disabled={importSongBusy}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2a2a2a",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: importSongBusy ? "not-allowed" : "pointer",
                      opacity: importSongBusy ? 0.6 : 1,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      const raw = (importSongCode || "").trim();
                      if (!raw) {
                        setImportSongScanError("Pegá un código.");
                        return;
                      }
                      if (!raw.startsWith("OC6:") && !raw.startsWith("OC6GZ:")) {
                        setImportSongScanError("El código debe empezar con OC6: o OC6GZ:.");
                        return;
                      }
                      // Validación superficial de caracteres para evitar pegar basura gigante
                      const payload = raw.split(":")[1] || "";
                      if (!payload || payload.length < 16) {
                        setImportSongScanError("El código parece incompleto.");
                        return;
                      }
                      if (!/^[A-Za-z0-9\-_]+$/.test(payload)) {
                        setImportSongScanError("El código contiene caracteres inválidos.");
                        return;
                      }

                      setImportSongBusy(true);
                      try {
                        await onImportSongCode(raw);
                        closeImportSongModal();
                      } catch (e: any) {
                        setImportSongScanError((e && typeof e === "object" && "message" in e ? (e as any).message : "") || "No se pudo importar el código.");
                      } finally {
                        setImportSongBusy(false);
                      }
                    }}
                    disabled={importSongBusy}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2b7a1f",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.15)",
                      cursor: importSongBusy ? "not-allowed" : "pointer",
                      opacity: importSongBusy ? 0.5 : 1,
                    }}
                  >
                    Importar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {deleteGroupModalOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              onClick={closeDeleteGroupModal}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 640,
                  maxWidth: "100%",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#1f1f1f",
                  padding: 14,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 14 }}>
                  Borrar {deleteGroupKind === "category" ? "categoría" : "subcategoría"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "pre-line" }}>
                  {`Esto va a borrar TODAS las canciones de esta ${deleteGroupKind === "category" ? "categoría" : "subcategoría"} y no se puede deshacer.\n\nPara confirmar, escribí exactamente:\n${deleteGroupName}`}
                </div>
                <input
                  ref={deleteGroupInputRef}
                  value={deleteGroupInput}
                  onChange={(e) => setDeleteGroupInput(e.target.value)}
                  placeholder={deleteGroupName}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "#111",
                    color: "#eaeaea",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={closeDeleteGroupModal}
                    disabled={deleteGroupBusy}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2a2a2a",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.12)",
                      cursor: deleteGroupBusy ? "not-allowed" : "pointer",
                      opacity: deleteGroupBusy ? 0.6 : 1,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (deleteGroupBusy) return;
                      if ((deleteGroupInput || "").trim() !== (deleteGroupName || "").trim()) {
                        showToast("Confirmación inválida. No se borró nada.");
                        return;
                      }
                      setDeleteGroupBusy(true);
                      try {
                        if (deleteGroupKind === "category") {
                          await onDeleteCategory(deleteGroupName);
                        } else {
                          await onDeleteSubcategory(deleteGroupName);
                        }
                        setSelectedCategory(null);
                        setSelectedSubcategory(null);
                        setSelectedSongName(null);
                        closeDeleteGroupModal();
                      } finally {
                        setDeleteGroupBusy(false);
                      }
                    }}
                    disabled={deleteGroupBusy}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#7a1f1f",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.15)",
                      cursor: deleteGroupBusy ? "not-allowed" : "pointer",
                      opacity: deleteGroupBusy ? 0.6 : 1,
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.10)",
          padding: 12,
          background: "rgba(0,0,0,0.10)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => void onExportAll()}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
            }}
            title="Exportar compendio como JSON"
          >
            Exportar compendio
          </button>
          <button
            onClick={() => {
              setImportModalOpen(true);
              setImportDragging(false);
              setImportFile(null);
              setImportScanError("");
              setImportScanInfo("");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
            }}
            title="Importar compendio desde JSON"
          >
            Importar compendio
          </button>
          <button
            onClick={() => {
              setImportSongModalOpen(true);
              setImportSongCode("");
              setImportSongScanError("");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#1f1f1f",
              color: "#eaeaea",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
            }}
            title="Importar una canción pegando el código"
          >
            Importar cancion
          </button>
        </div>

        <button
          onClick={() => void onClearAll()}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "#7a1f1f",
            color: "#eaeaea",
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "pointer",
            marginLeft: "auto",
          }}
          title="Borrar todas las canciones guardadas"
        >
          Borrar compendio
        </button>
      </div>
    </div>
  );
}

