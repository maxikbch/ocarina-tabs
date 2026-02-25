"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import PianoKeyboard from "@/components/PianoKeyboard";
import { formatNoteLabel, type NoteLabelMode } from "@/lib/noteLabels";
import type { NoteId } from "@/lib/types";
import { hasFingeringForNote } from "@/lib/fingerings";
import { nanoid } from "nanoid";
import {
  COMPOSER_KEY_BINDINGS,
  SHOW_DELETE_BUTTONS_ON_ITEMS,
  matchesAnyKeyBinding,
  matchesKeyBinding,
} from "@/lib/config";
import {
  duplicateItemsWithNewIds,
  flattenDoc,
  getDisplayNote,
  isSpecialToken,
  makeUniqueSectionName,
  normalizeSectionName,
  type SongDoc,
  type SongItem,
  type SongSectionInstance,
} from "@/lib/songDoc";

function isBreakToken(note: string): boolean {
  return note === "⏎" || note === "BR" || note === "SALTO";
}

function ToggleButton({
  active,
  label,
  onClick,
  title,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={title}
      style={{
        padding: "8px 10px",
        borderRadius: 12,
        border: active ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.18)",
        background: active ? "#333" : "#1f1f1f",
        color: "#eaeaea",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 800,
        width: 68,
        textAlign: "center",
      }}
    >
      {label}
    </button>
  );
}

function ModalShell({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
      }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 520px)",
          background: "#1f1f1f",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", color: "#eaeaea", border: "none", fontSize: 18, cursor: "pointer" }} aria-label="Cerrar" title="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function sectionNames(doc: SongDoc): string[] {
  return Object.values(doc.sectionsById).map((s) => s.name);
}

function getInstanceSection(doc: SongDoc, instanceId: string | null): { instanceId: string; sectionId: string } | null {
  if (!doc.arrangement.length) return null;
  if (instanceId) {
    const inst = doc.arrangement.find((x) => x.id === instanceId);
    if (inst && doc.sectionsById[inst.sectionId]) return { instanceId: inst.id, sectionId: inst.sectionId };
  }
  const fallback = doc.arrangement[doc.arrangement.length - 1];
  return fallback ? { instanceId: fallback.id, sectionId: fallback.sectionId } : null;
}

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
      if (width <= 0) return; // evita flashes por mediciones transitorias
      const next = Math.max(1, Math.floor((width + gapPx) / (minCellPx + gapPx)));
      if (next !== colsRef.current) {
        colsRef.current = next;
        setCols(next);
      }
    };

    // Medir antes de pintar (reduce flicker)
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

export default function ComposerWorkspace({
  notes,
  labelMode,
  doc,
  onDocChange,
  transpose,
  testMode,
  freeMode,
  onTestModeChange,
  onFreeModeChange,
  onTransposeDec,
  onTransposeInc,
  isEnabledNote,
  onPreviewNote,
}: {
  notes: string[];
  labelMode: NoteLabelMode;
  doc: SongDoc;
  onDocChange: (next: SongDoc) => void;
  transpose: number;
  testMode: boolean;
  freeMode: boolean;
  onTestModeChange: (next: boolean) => void;
  onFreeModeChange: (next: boolean) => void;
  onTransposeDec: () => void;
  onTransposeInc: () => void;
  isEnabledNote: (noteId: NoteId) => boolean;
  onPreviewNote: (note: string) => void | Promise<void>;
}) {
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(doc.arrangement[0]?.id ?? null);
  const [selected, setSelected] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [repOpen, setRepOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteInstanceId, setPendingDeleteInstanceId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameSectionId, setRenameSectionId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const [createName, setCreateName] = useState("");
  const [dupName, setDupName] = useState("");
  const [dupFrom, setDupFrom] = useState<string>("");
  const [repFrom, setRepFrom] = useState<string>("");

  const [clipboardToast, setClipboardToast] = useState<string | null>(null);
  const clipboardToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sectionsList = useMemo(() => {
    return Object.values(doc.sectionsById)
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [doc]);

  const itemSectionById = useMemo(() => {
    const m = new Map<string, string>();
    for (const sec of Object.values(doc.sectionsById)) {
      for (const it of sec.items) m.set(it.id, sec.id);
    }
    return m;
  }, [doc]);

  function preservePageScroll() {
    const el = document.scrollingElement;
    const top = el?.scrollTop ?? window.scrollY ?? 0;
    const left = el?.scrollLeft ?? window.scrollX ?? 0;
    const restore = () => {
      if (el) {
        el.scrollTop = top;
        el.scrollLeft = left;
      } else {
        window.scrollTo({ top, left, behavior: "auto" });
      }
    };
    // Restaurar en el próximo frame (después del re-render/layout)
    requestAnimationFrame(restore);
    // Y una vez más por seguridad si algún efecto/layout corre después
    setTimeout(restore, 0);
  }

  // Limpia la selección si el doc cambió (ej: cargar canción) y ya no existen IDs
  useEffect(() => {
    setSelectedItemIds((cur) => {
      if (cur.size === 0) return cur;
      let changed = false;
      const next = new Set<string>();
      for (const id of cur) {
        if (itemSectionById.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : cur;
    });
    setSelected((cur) => {
      if (!cur) return null;
      if (!itemSectionById.has(cur.itemId)) return null;
      return cur;
    });
  }, [itemSectionById]);

  function setSingleSelection(sectionId: string, itemId: string) {
    setSelected({ sectionId, itemId });
    setSelectedItemIds(new Set([itemId]));
  }

  function toggleSelection(sectionId: string, itemId: string) {
    setSelected({ sectionId, itemId });
    setSelectedItemIds((cur) => {
      const next = new Set(cur);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectRangeInSection(sectionId: string, fromItemId: string, toItemId: string, unionWithExisting: boolean) {
    const sec = doc.sectionsById[sectionId];
    if (!sec) {
      setSingleSelection(sectionId, toItemId);
      return;
    }
    const a = sec.items.findIndex((x) => x.id === fromItemId);
    const b = sec.items.findIndex((x) => x.id === toItemId);
    if (a < 0 || b < 0) {
      setSingleSelection(sectionId, toItemId);
      return;
    }
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const rangeIds = sec.items.slice(lo, hi + 1).map((it) => it.id);

    setSelected({ sectionId, itemId: toItemId });
    setSelectedItemIds((cur) => {
      if (!unionWithExisting) return new Set(rangeIds);
      const next = new Set(cur);
      for (const id of rangeIds) next.add(id);
      return next;
    });
  }

  function patchDoc(mut: (draft: SongDoc) => void) {
    const next: SongDoc = {
      ...doc,
      sectionsById: structuredClone(doc.sectionsById),
      arrangement: doc.arrangement.map((x) => ({ ...x })),
    };
    mut(next);
    onDocChange(next);
  }

  async function handleInsertNote(rawNote: string) {
    await onPreviewNote(rawNote);
    if (testMode) return;
    const target = getInstanceSection(doc, activeInstanceId);
    if (!target) return;

    const storedNote = rawNote; // already base, transpose is visual only
    const sec = doc.sectionsById[target.sectionId];
    if (!sec) return;

    const insertAfterId = selected && selected.sectionId === sec.id ? selected.itemId : null;
    const newItemId = nanoid();
    preservePageScroll();
    patchDoc((d) => {
      const s = d.sectionsById[sec.id];
      if (!s) return;
      const item: SongItem = { id: newItemId, note: storedNote };
      if (!insertAfterId) {
        s.items = [...s.items, item];
      } else {
        const idx = s.items.findIndex((x) => x.id === insertAfterId);
        if (idx >= 0) {
          const copy = [...s.items];
          copy.splice(idx + 1, 0, item);
          s.items = copy;
        } else {
          s.items = [...s.items, item];
        }
      }
    });
    setActiveInstanceId(target.instanceId);
    setSingleSelection(target.sectionId, newItemId);
  }

  function insertSpecial(token: "—" | "⏎") {
    const target = getInstanceSection(doc, activeInstanceId);
    if (!target) return;
    const sec = doc.sectionsById[target.sectionId];
    if (!sec) return;
    const insertAfterId = selected && selected.sectionId === sec.id ? selected.itemId : null;
    const newItemId = nanoid();
    preservePageScroll();
    patchDoc((d) => {
      const s = d.sectionsById[sec.id];
      if (!s) return;
      const item: SongItem = { id: newItemId, note: token };
      if (!insertAfterId) {
        s.items = [...s.items, item];
      } else {
        const idx = s.items.findIndex((x) => x.id === insertAfterId);
        const copy = [...s.items];
        copy.splice(idx >= 0 ? idx + 1 : copy.length, 0, item);
        s.items = copy;
      }
    });
    setActiveInstanceId(target.instanceId);
    setSingleSelection(target.sectionId, newItemId);
  }

  function removeItem(sectionId: string, itemId: string) {
    patchDoc((d) => {
      const s = d.sectionsById[sectionId];
      if (!s) return;
      s.items = s.items.filter((x) => x.id !== itemId);
    });
    setSelected((cur) => (cur && cur.sectionId === sectionId && cur.itemId === itemId ? null : cur));
    setSelectedItemIds((cur) => {
      if (!cur.has(itemId)) return cur;
      const next = new Set(cur);
      next.delete(itemId);
      return next;
    });
  }

  function removeManyItems(itemIds: string[]) {
    if (itemIds.length === 0) return;
    const ids = new Set(itemIds);
    patchDoc((d) => {
      for (const sec of Object.values(d.sectionsById)) {
        if (sec.items.some((x) => ids.has(x.id))) {
          sec.items = sec.items.filter((x) => !ids.has(x.id));
        }
      }
    });
    setSelected((cur) => (cur && ids.has(cur.itemId) ? null : cur));
    setSelectedItemIds((cur) => {
      if (cur.size === 0) return cur;
      let changed = false;
      const next = new Set<string>();
      for (const id of cur) {
        if (!ids.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : cur;
    });
  }

  function getSelectedItemsInOrder(): SongItem[] {
    if (selectedItemIds.size > 0) {
      const flat = flattenDoc(doc);
      const ids = selectedItemIds;
      const items: SongItem[] = [];
      for (const ref of flat) {
        if (!ids.has(ref.itemId)) continue;
        const sec = doc.sectionsById[ref.sectionId];
        const it = sec?.items.find((x) => x.id === ref.itemId);
        if (it) items.push(it);
      }
      return items;
    }
    if (selected) {
      const sec = doc.sectionsById[selected.sectionId];
      const it = sec?.items.find((x) => x.id === selected.itemId);
      return it ? [it] : [];
    }
    return [];
  }

  function showClipboardToast(message: string) {
    setClipboardToast(message);
    if (clipboardToastRef.current) {
      clearTimeout(clipboardToastRef.current);
      clipboardToastRef.current = null;
    }
    clipboardToastRef.current = setTimeout(() => {
      setClipboardToast(null);
      clipboardToastRef.current = null;
    }, 1800);
  }

  function copySelection() {
    const items = getSelectedItemsInOrder();
    if (items.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify({ ocarinaNotes: items })).catch(() => {});
    showClipboardToast("Copiado");
  }

  function cutSelection() {
    const items = getSelectedItemsInOrder();
    if (items.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify({ ocarinaNotes: items })).catch(() => {});
    preservePageScroll();
    if (selectedItemIds.size > 1) {
      removeManyItems(Array.from(selectedItemIds));
    } else if (selected) {
      removeItem(selected.sectionId, selected.itemId);
    }
    showClipboardToast("Cortado");
  }

  async function pasteFromClipboard() {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    let payload: { ocarinaNotes?: SongItem[] };
    try {
      payload = JSON.parse(text);
    } catch {
      return;
    }
    const raw = payload?.ocarinaNotes;
    if (!Array.isArray(raw) || raw.length === 0) return;
    const newItems = duplicateItemsWithNewIds(raw);
    const target = getInstanceSection(doc, activeInstanceId);
    if (!target) return;
    const sec = doc.sectionsById[target.sectionId];
    if (!sec) return;
    let insertIndex: number;
    if (selected?.sectionId === sec.id && selected.itemId) {
      const idx = sec.items.findIndex((x) => x.id === selected.itemId);
      insertIndex = idx >= 0 ? idx + 1 : sec.items.length;
    } else {
      insertIndex = sec.items.length;
    }
    preservePageScroll();
    patchDoc((d) => {
      const s = d.sectionsById[target.sectionId];
      if (!s) return;
      const copy = [...s.items];
      copy.splice(insertIndex, 0, ...newItems);
      s.items = copy;
    });
    setActiveInstanceId(target.instanceId);
    setSingleSelection(target.sectionId, newItems[newItems.length - 1].id);
    setSelectedItemIds(new Set(newItems.map((i) => i.id)));
    showClipboardToast("Pegado");
  }

  function removeInstance(instanceId: string) {
    patchDoc((d) => {
      const inst = d.arrangement.find((x) => x.id === instanceId);
      if (!inst) return;
      const sectionId = inst.sectionId;
      const count = d.arrangement.filter((x) => x.sectionId === sectionId).length;
      d.arrangement = d.arrangement.filter((x) => x.id !== instanceId);
      if (count <= 1) {
        delete d.sectionsById[sectionId];
      }
      if (d.arrangement.length === 0 || Object.keys(d.sectionsById).length === 0) {
        const fresh = ((): SongDoc => {
          const sid = nanoid();
          const iid = nanoid();
          return { version: 1, sectionsById: { [sid]: { id: sid, name: "General", items: [] } }, arrangement: [{ id: iid, sectionId: sid }] };
        })();
        d.sectionsById = fresh.sectionsById;
        d.arrangement = fresh.arrangement;
      }
    });
    setActiveInstanceId((cur) => (cur === instanceId ? null : cur));
  }

  function requestRemoveInstance(instanceId: string) {
    const inst = doc.arrangement.find((x) => x.id === instanceId);
    if (!inst) return;
    const count = doc.arrangement.filter((x) => x.sectionId === inst.sectionId).length;
    if (count > 1) {
      removeInstance(instanceId);
      return;
    }
    setPendingDeleteInstanceId(instanceId);
    setConfirmDeleteOpen(true);
  }

  function reorderInstance(sourceInstanceId: string, targetIndex: number) {
    patchDoc((d) => {
      const from = d.arrangement.findIndex((x) => x.id === sourceInstanceId);
      if (from < 0) return;
      const clampedTarget = Math.max(0, Math.min(targetIndex, d.arrangement.length - 1));
      const arr = [...d.arrangement];
      const [item] = arr.splice(from, 1);
      arr.splice(clampedTarget, 0, item);
      d.arrangement = arr;
    });
  }

  function openRename(sectionId: string) {
    const sec = doc.sectionsById[sectionId];
    if (!sec) return;
    setRenameSectionId(sectionId);
    setRenameText(sec.name);
    setRenameOpen(true);
  }

  function applyRename() {
    const sectionId = renameSectionId;
    if (!sectionId) return;
    const sec = doc.sectionsById[sectionId];
    if (!sec) return;
    const others = Object.values(doc.sectionsById)
      .filter((s) => s.id !== sectionId)
      .map((s) => s.name);
    const unique = makeUniqueSectionName(normalizeSectionName(renameText), others);
    patchDoc((d) => {
      const s = d.sectionsById[sectionId];
      if (!s) return;
      s.name = unique;
    });
    setRenameOpen(false);
    setRenameSectionId(null);
    setRenameText("");
  }

  function moveItem(payload: { fromSectionId: string; itemId: string }, toSectionId: string, beforeItemId: string | null) {
    if (!payload?.fromSectionId || !payload.itemId) return;
    if (payload.fromSectionId === toSectionId && beforeItemId && payload.itemId === beforeItemId) {
      // Soltar sobre la misma casilla: no-op
      return;
    }
    patchDoc((d) => {
      const from = d.sectionsById[payload.fromSectionId];
      const to = d.sectionsById[toSectionId];
      if (!from || !to) return;
      const idx = from.items.findIndex((x) => x.id === payload.itemId);
      if (idx < 0) return;
      const [moved] = from.items.splice(idx, 1);
      const insertAt = beforeItemId ? Math.max(0, to.items.findIndex((x) => x.id === beforeItemId)) : to.items.length;
      to.items.splice(insertAt >= 0 ? insertAt : to.items.length, 0, moved);
    });
  }

  function moveManyItems(
    payload: { fromSectionId: string; itemIds: string[] } | { fromSectionId: string; itemId: string },
    toSectionId: string,
    beforeItemId: string | null
  ) {
    const fromSectionId = (payload as any)?.fromSectionId as string | undefined;
    const itemIds = (payload as any)?.itemIds as string[] | undefined;
    const singleItemId = (payload as any)?.itemId as string | undefined;
    if (!fromSectionId) return;
    const ids = itemIds?.length ? itemIds : singleItemId ? [singleItemId] : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);

    if (fromSectionId === toSectionId && beforeItemId && idSet.has(beforeItemId)) {
      // soltar sobre el mismo bloque seleccionado: no-op
      return;
    }

    patchDoc((d) => {
      const from = d.sectionsById[fromSectionId];
      const to = d.sectionsById[toSectionId];
      if (!from || !to) return;

      // Mantener el orden original en la sección origen
      const moved = from.items.filter((x) => idSet.has(x.id));
      if (moved.length === 0) return;

      // Remover primero
      from.items = from.items.filter((x) => !idSet.has(x.id));

      // Insertar en destino (si es la misma sección, ya estamos sobre el array removido)
      const targetItems = to.items;
      const rawIdx = beforeItemId ? targetItems.findIndex((x) => x.id === beforeItemId) : -1;
      const insertAt = beforeItemId ? (rawIdx >= 0 ? rawIdx : targetItems.length) : targetItems.length;
      targetItems.splice(insertAt, 0, ...moved);
    });
  }

  // Teclas: ver COMPOSER_KEY_BINDINGS en lib/config.ts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as any)?.isContentEditable) return;

      if (matchesKeyBinding(e, COMPOSER_KEY_BINDINGS.clearSelection)) {
        setSelected(null);
        setSelectedItemIds(new Set());
        return;
      }

      if (matchesAnyKeyBinding(e, COMPOSER_KEY_BINDINGS.delete)) {
        if (selectedItemIds.size > 0) {
          e.preventDefault();
          removeManyItems(Array.from(selectedItemIds));
        } else if (selected) {
          e.preventDefault();
          removeItem(selected.sectionId, selected.itemId);
        }
        return;
      }

      if (matchesKeyBinding(e, COMPOSER_KEY_BINDINGS.copy)) {
        e.preventDefault();
        copySelection();
      } else if (matchesKeyBinding(e, COMPOSER_KEY_BINDINGS.cut)) {
        e.preventDefault();
        cutSelection();
      } else if (matchesKeyBinding(e, COMPOSER_KEY_BINDINGS.paste)) {
        e.preventDefault();
        pasteFromClipboard();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeManyItems, removeItem, selected, selectedItemIds, copySelection, cutSelection, pasteFromClipboard]);

  function createSection() {
    const unique = makeUniqueSectionName(normalizeSectionName(createName), sectionNames(doc));
    const sectionId = nanoid();
    const instanceId = nanoid();
    patchDoc((d) => {
      d.sectionsById[sectionId] = { id: sectionId, name: unique, items: [] };
      d.arrangement = [...d.arrangement, { id: instanceId, sectionId }];
    });
    setActiveInstanceId(instanceId);
    setCreateOpen(false);
    setCreateName("");
  }

  function duplicateSection() {
    if (!dupFrom) return;
    const src = doc.sectionsById[dupFrom];
    if (!src) return;
    const unique = makeUniqueSectionName(normalizeSectionName(dupName), sectionNames(doc));
    const sectionId = nanoid();
    const instanceId = nanoid();
    patchDoc((d) => {
      d.sectionsById[sectionId] = { id: sectionId, name: unique, items: duplicateItemsWithNewIds(src.items) };
      d.arrangement = [...d.arrangement, { id: instanceId, sectionId }];
    });
    setActiveInstanceId(instanceId);
    setDupOpen(false);
    setDupName("");
    setDupFrom("");
  }

  function replicateSection() {
    if (!repFrom) return;
    const src = doc.sectionsById[repFrom];
    if (!src) return;
    const instanceId = nanoid();
    patchDoc((d) => {
      d.arrangement = [...d.arrangement, { id: instanceId, sectionId: repFrom }];
    });
    setActiveInstanceId(instanceId);
    setRepOpen(false);
    setRepFrom("");
  }

  function SectionBlock({ inst, idx }: { inst: SongSectionInstance; idx: number }) {
    const sec = doc.sectionsById[inst.sectionId];
    if (!sec) return null;
    const active = inst.id === activeInstanceId;
    const grid = useGridColumns(60, 10);

    // Render items with explicit line breaks for "⏎"/"BR"/"SALTO"
    const rendered = (() => {
      const out: Array<React.ReactNode> = [];
      let col = 0;
      const cols = grid.cols || 1;

      const pushFillToEndOfRow = (breakItemId: string) => {
        const rem = col % cols;
        if (rem === 0) return;
        const fill = cols - rem;
        for (let i = 0; i < fill; i++) {
          out.push(
            <div
              key={`ph-${breakItemId}-${i}`}
              style={{
                visibility: "hidden",
                pointerEvents: "none",
                aspectRatio: "1 / 1",
                borderRadius: 12,
                border: "1px solid transparent",
              }}
            />
          );
          col++;
        }
      };

      for (const it of sec.items) {
        const shown = getDisplayNote(it.note, transpose);

        if (isBreakToken(shown)) {
          pushFillToEndOfRow(it.id);
          const multiSelectedHere = selectedItemIds.has(it.id);
          out.push(
            <div
              key={`br-${it.id}`}
              style={{
                gridColumn: "1 / -1",
                height: 26,
                borderRadius: 10,
                border: (selected?.sectionId === sec.id && selected?.itemId === it.id) || multiSelectedHere ? "2px solid rgba(255,255,255,0.85)" : "1px dashed rgba(255,255,255,0.25)",
                background: "rgba(0,0,0,0.12)",
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                gap: 8,
                cursor: "pointer",
                userSelect: "none",
              }}
              draggable
              onDragStart={(e) => {
                const idsInSameSection = Array.from(selectedItemIds).filter((id) => itemSectionById.get(id) === sec.id);
                const itemIds = selectedItemIds.has(it.id) && idsInSameSection.length > 0 ? idsInSameSection : [it.id];
                e.dataTransfer.setData("application/json", JSON.stringify({ fromSectionId: sec.id, itemIds }));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const raw = e.dataTransfer.getData("application/json");
                if (!raw) return;
                try {
                  const p = JSON.parse(raw) as any;
                  moveManyItems(p, sec.id, it.id);
                  setActiveInstanceId(inst.id);
                } catch {}
              }}
              onClick={(e) => {
                preservePageScroll();
                setActiveInstanceId(inst.id);
                if (e.shiftKey && selected?.sectionId === sec.id && selected.itemId) {
                  selectRangeInSection(sec.id, selected.itemId, it.id, Boolean(e.metaKey || e.ctrlKey));
                  return;
                }
                if (e.metaKey || e.ctrlKey) {
                  toggleSelection(sec.id, it.id);
                  return;
                }
                setSingleSelection(sec.id, it.id);
              }}
              title="Salto de línea"
              aria-label="Salto de línea"
            >
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85 }}>↵</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Salto</div>
              {SHOW_DELETE_BUTTONS_ON_ITEMS && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    preservePageScroll();
                    if (selectedItemIds.size > 1 && selectedItemIds.has(it.id)) {
                      removeManyItems(Array.from(selectedItemIds));
                    } else {
                      removeItem(sec.id, it.id);
                    }
                  }}
                  aria-label="Borrar salto"
                  title="Borrar"
                  tabIndex={-1}
                  style={{
                    marginLeft: "auto",
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
              )}
            </div>
          );
          col = 0;
          continue;
        }

        const isSpace = shown === "—" || shown === "SPACE";
        const label = isSpecialToken(shown) ? (shown === "—" ? "—" : "↵") : formatNoteLabel(shown, labelMode);
        const invalid = !isSpecialToken(shown) && !hasFingeringForNote(shown as any);
        const selectedHere = selected?.sectionId === sec.id && selected?.itemId === it.id;
        const multiSelectedHere = selectedItemIds.has(it.id);

        out.push(
          <div
            key={it.id}
            draggable
            onDragStart={(e) => {
              const base = { fromSectionId: sec.id };
              const idsInSameSection = Array.from(selectedItemIds).filter((id) => itemSectionById.get(id) === sec.id);
              const itemIds = selectedItemIds.has(it.id) && idsInSameSection.length > 0 ? idsInSameSection : [it.id];
              e.dataTransfer.setData("application/json", JSON.stringify({ ...base, itemIds }));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const raw = e.dataTransfer.getData("application/json");
              if (!raw) return;
              try {
                const p = JSON.parse(raw) as any;
                moveManyItems(p, sec.id, it.id);
                setActiveInstanceId(inst.id);
              } catch {}
            }}
            onClick={async (e) => {
              preservePageScroll();
              setActiveInstanceId(inst.id);
              if (e.shiftKey && selected?.sectionId === sec.id && selected.itemId) {
                selectRangeInSection(sec.id, selected.itemId, it.id, Boolean(e.metaKey || e.ctrlKey));
                return;
              }
              if (e.metaKey || e.ctrlKey) {
                toggleSelection(sec.id, it.id);
                return;
              }
              setSingleSelection(sec.id, it.id);
              if (!isSpecialToken(shown)) {
                await onPreviewNote(shown);
              }
            }}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              aspectRatio: "1 / 1",
              padding: isSpace ? 4 : 6,
              borderRadius: 12,
              border: selectedHere || multiSelectedHere
                ? "2px solid rgba(255,255,255,0.85)"
                : invalid
                ? "1px solid rgba(255, 80, 80, 0.6)"
                : isSpace
                ? "1px dashed rgba(255,255,255,0.25)"
                : "1px solid rgba(255,255,255,0.18)",
              background: invalid ? "#5a2a2a" : isSpace ? "rgba(0,0,0,0.12)" : "#555555",
              cursor: "pointer",
              userSelect: "none",
              transform: isSpace ? "scale(0.94)" : undefined,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: isSpace ? 11 : 12,
                textAlign: "center",
                lineHeight: 1,
                color: isSpace ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.95)",
              }}
            >
              {label}
            </div>
            {SHOW_DELETE_BUTTONS_ON_ITEMS && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  preservePageScroll();
                  if (selectedItemIds.size > 1 && selectedItemIds.has(it.id)) {
                    removeManyItems(Array.from(selectedItemIds));
                  } else {
                    removeItem(sec.id, it.id);
                  }
                }}
                aria-label="Borrar nota"
                title="Borrar"
                tabIndex={-1}
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
            )}
          </div>
        );
        col++;
      }

      return out;
    })();

    return (
      <div
        key={inst.id}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const sourceId = e.dataTransfer.getData("text/plain");
          if (!sourceId || sourceId === inst.id) return;
          reorderInstance(sourceId, idx);
        }}
        style={{
          border: active ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 14,
          padding: 10,
        }}
      >
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", inst.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onMouseDown={() => setActiveInstanceId(inst.id)}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "grab", userSelect: "none" }}
          title="Arrastrar para reordenar sección"
          aria-label="Arrastrar para reordenar sección"
        >
          <div style={{ fontWeight: 900 }}>{sec.name}</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openRename(sec.id);
            }}
            aria-label="Renombrar sección"
            title="Renombrar sección"
            style={{
              border: "none",
              background: "none",
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: "2px 4px",
            }}
          >
            ✎
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              requestRemoveInstance(inst.id);
            }}
            style={{ marginLeft: "auto", border: "none", background: "none", color: "rgba(255,255,255,0.85)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
            title="Borrar sección"
            aria-label="Borrar sección"
          >
            ✕
          </button>
        </div>

        <div
          ref={grid.ref}
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: `repeat(${grid.cols}, minmax(60px, 1fr))`,
            alignItems: "start",
          }}
          onDragOver={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            // Click en “fondo” de la grilla: limpiar selección
            if (e.target === e.currentTarget) {
              preservePageScroll();
              setActiveInstanceId(inst.id);
              setSelected(null);
              setSelectedItemIds(new Set());
            }
          }}
        >
          {rendered}

          <div
            key="drop-end"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/json");
              if (!raw) return;
              try {
                preservePageScroll();
                const p = JSON.parse(raw) as any;
                // Si la sección está vacía, esto inserta al inicio (index 0).
                // Si no está vacía, actúa como "Mover al final".
                moveManyItems(p, sec.id, null);
                setActiveInstanceId(inst.id);
              } catch {}
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 6,
              borderRadius: 12,
              border: "1px dashed rgba(255,255,255,0.25)",
              background: "rgba(0,0,0,0.12)",
              boxSizing: "border-box",
              color: "rgba(255,255,255,0.75)",
              userSelect: "none",
              textAlign: "center",
              fontSize: 11,
              aspectRatio: sec.items.length === 0 ? undefined : "1 / 1",
              cursor: "default",
              gridColumn: sec.items.length === 0 ? "1 / -1" : undefined,
              height: sec.items.length === 0 ? 56 : undefined,
            }}
            title={sec.items.length === 0 ? "Soltar aquí para mover a esta sección" : "Mover nota al final"}
            aria-label={sec.items.length === 0 ? "Zona de drop en sección vacía" : "Mover nota al final"}
          >
            {sec.items.length === 0 ? "Soltar aquí" : "Mover al final"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 12,
          zIndex: 50,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          padding: 10,
        }}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 900, textAlign: "center" }}>Teclado</div>
          <div style={{ position: "absolute", right: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onTransposeDec} style={{ padding: "3px 8px", borderRadius: 10 }}>
              –
            </button>
            <span style={{ minWidth: 24, textAlign: "center", fontSize: 12 }}>{transpose}</span>
            <button onClick={onTransposeInc} style={{ padding: "3px 8px", borderRadius: 10 }}>
              +
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "78px 1fr 78px", alignItems: "center", columnGap: 10, marginTop: 8 }}>
          <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
            <ToggleButton active={testMode} label="Test" title="Test Mode: no guardar notas al tocar" onClick={() => onTestModeChange(!testMode)} />
            <ToggleButton active={freeMode} label="Free" title="Free Mode: tocar todas las teclas" onClick={() => onFreeModeChange(!freeMode)} />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "min(100%, 780px)" }}>
              <PianoKeyboard notes={notes} labelMode={labelMode} onNoteClick={handleInsertNote} isEnabledNote={isEnabledNote} />
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
            <button
              onClick={() => insertSpecial("—")}
              style={{ padding: "8px 8px", borderRadius: 12, width: "68px", height: "68px", whiteSpace: "nowrap", background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", fontSize: 12 }}
              title="Insertar un espacio en la canción"
            >
              Espacio
            </button>
            <button
              onClick={() => insertSpecial("⏎")}
              style={{ padding: "8px 8px", borderRadius: 12, width: "68px", height: "68px", whiteSpace: "nowrap", background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", fontSize: 12 }}
              title="Insertar un salto de línea"
            >
              Salto
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {doc.arrangement.map((inst, idx) => (
          <SectionBlock key={inst.id} inst={inst} idx={idx} />
        ))}

        {doc.arrangement.length > 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const sourceId = e.dataTransfer.getData("text/plain");
              if (!sourceId) return;
              reorderInstance(sourceId, doc.arrangement.length - 1);
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
              color: "rgba(255,255,255,0.7)",
              userSelect: "none",
              textAlign: "center",
              fontSize: 12,
            }}
            title="Soltar aquí para mover la sección al final"
            aria-label="Zona de drop al final"
          >
            Mover sección al final
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        <button onClick={() => setCreateOpen(true)} style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
          Crear sección
        </button>
        <button onClick={() => setDupOpen(true)} style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
          Duplicar sección
        </button>
        <button onClick={() => setRepOpen(true)} style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
          Replicar sección
        </button>
      </div>

      <ModalShell open={createOpen} title="Crear sección" onClose={() => setCreateOpen(false)}>
        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
          Nombre
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder='Ej: "Intro"'
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#111", color: "#eaeaea" }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button onClick={() => setCreateOpen(false)} style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
            Cancelar
          </button>
          <button onClick={createSection} style={{ padding: "8px 12px", borderRadius: 10, background: "#2b7a1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
            Crear
          </button>
        </div>
      </ModalShell>

      <ModalShell open={dupOpen} title="Duplicar sección" onClose={() => setDupOpen(false)}>
        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
          Sección a duplicar
          <select
            value={dupFrom}
            onChange={(e) => setDupFrom(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#111", color: "#eaeaea" }}
          >
            <option value="">(Elegí una sección)</option>
            {sectionsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
          Nombre del duplicado
          <input
            value={dupName}
            onChange={(e) => setDupName(e.target.value)}
            placeholder='Ej: "Intro (variante)"'
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#111", color: "#eaeaea" }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button onClick={() => setDupOpen(false)} style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
            Cancelar
          </button>
          <button
            onClick={duplicateSection}
            disabled={!dupFrom}
            style={{ padding: "8px 12px", borderRadius: 10, background: "#2b7a1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", opacity: !dupFrom ? 0.5 : 1, cursor: !dupFrom ? "not-allowed" : "pointer" }}
          >
            Duplicar
          </button>
        </div>
      </ModalShell>

      <ModalShell open={repOpen} title="Replicar sección" onClose={() => setRepOpen(false)}>
        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
          Sección a replicar
          <select
            value={repFrom}
            onChange={(e) => setRepFrom(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#111", color: "#eaeaea" }}
          >
            <option value="">(Elegí una sección)</option>
            {sectionsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button onClick={() => setRepOpen(false)} style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
            Cancelar
          </button>
          <button
            onClick={replicateSection}
            disabled={!repFrom}
            style={{ padding: "8px 12px", borderRadius: 10, background: "#2b7a1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", opacity: !repFrom ? 0.5 : 1, cursor: !repFrom ? "not-allowed" : "pointer" }}
          >
            Replicar
          </button>
        </div>
      </ModalShell>

      <ModalShell open={confirmDeleteOpen} title="Borrar sección" onClose={() => setConfirmDeleteOpen(false)}>
        <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
          Vas a borrar la última instancia de esta sección. Esto eliminará la sección por completo.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button
            onClick={() => {
              setConfirmDeleteOpen(false);
              setPendingDeleteInstanceId(null);
            }}
            style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              const id = pendingDeleteInstanceId;
              setConfirmDeleteOpen(false);
              setPendingDeleteInstanceId(null);
              if (id) removeInstance(id);
            }}
            style={{ padding: "8px 12px", borderRadius: 10, background: "#7a1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            Borrar
          </button>
        </div>
      </ModalShell>

      <ModalShell open={renameOpen} title="Renombrar sección" onClose={() => setRenameOpen(false)}>
        <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
          Nombre
          <input
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            placeholder='Ej: "Intro"'
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#111", color: "#eaeaea" }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button onClick={() => setRenameOpen(false)} style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
            Cancelar
          </button>
          <button onClick={applyRename} style={{ padding: "8px 12px", borderRadius: 10, background: "#2b7a1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}>
            Guardar
          </button>
        </div>
      </ModalShell>
      {clipboardToast && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 1200,
            background: "rgba(32,32,32,0.96)",
            color: "#eaeaea",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
            fontSize: 14,
          }}
          role="status"
          aria-live="polite"
        >
          {clipboardToast}
        </div>
      )}
    </>
  );
}

