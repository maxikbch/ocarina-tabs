"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ModeSidebar from "@/components/ModeSidebar";
import ComposeMode from "@/components/modes/ComposeMode";
import PlayMode from "@/components/modes/PlayMode";
import CompendiumManager from "@/components/CompendiumManager";
import type { Fingering, NoteEvent, NoteId } from "@/lib/types";
import { getFingeringForNote, EMPTY } from "@/lib/fingerings";
import { buildChromaticRange, shiftNote } from "@/lib/notes";
import type { NoteLabelMode } from "@/lib/noteLabels";
import { createEmptySongDocV2, docFingerprintV2, normalizeSongDocV2, patchSongDocV2, type SongDocV2 } from "@/lib/songDocV2";
import { migrateV1ToV2 } from "@/lib/songDocMigrate";
import { flattenDocV2ForPlay } from "@/lib/songDocV2Adapter";
import { analyzePlayability } from "@/lib/songConflicts";
import { listSongNames, loadSongDoc, removeSong, hasSong, downloadBundle, getSongTranspose, clearAllSongs, listSongsWithCategories, listCategories, renameSong, renameCategory, renameSubcategory, setSongCategory, setSongSubcategory, saveSongDocV2, loadSongDocV2, getSongDocFormat, saveDraftV2, loadDraftV2, clearDraftV2, type DraftRecoveryV2, importCompendiumParsed, parseShareCode } from "@/lib/songStore";
import SongPickerSidebar from "@/components/SongPickerSidebar";
import SaveSongModal from "@/components/SaveSongModal";
import RenameSongModal from "@/components/RenameSongModal";
import { usePiano } from "@/lib/usePiano";
import ErrorModal from "@/components/ErrorModal";
import ConfirmModal from "@/components/ConfirmModal";
import PromptModal from "@/components/PromptModal";
import LoadingModal from "@/components/LoadingModal";
import TitleBar from "@/components/TitleBar";
import { APP_KEY_BINDINGS, MAX_UNDO_STACK_SIZE, matchesKeyBinding } from "@/lib/config";

export default function Page() {
  // Podés cambiar esto por el rango real de tu ocarina
  const NOTES = useMemo(() => buildChromaticRange({ from: "C4", to: "C6" }), []);

  const [docV2, setDocV2] = useState<SongDocV2>(() => createEmptySongDocV2());
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);
  const [noteLabelMode, setNoteLabelMode] = useState<NoteLabelMode>("latin");
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allSongs, setAllSongs] = useState<Array<{ name: string; category: string; subcategory: string }>>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const confirmResolverRef = useRef<(val: boolean) => void>();
  const [importChoiceMsg, setImportChoiceMsg] = useState<string | null>(null);
  const importChoiceResolverRef = useRef<(val: "overwrite" | "rename" | "skip") => void>();
  const [promptState, setPromptState] = useState<{ open: boolean; title: string; label: string; initial: string } | null>(null);
  const promptResolverRef = useRef<(val: string | null) => void>();
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [baselineFpV2, setBaselineFpV2] = useState<string>(() => "");
  const baselineFpV2Ref = useRef<string>("");
  const justSavedRef = useRef<boolean>(false);
  const [unsavedReminderOpen, setUnsavedReminderOpen] = useState(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState<"tocar" | "componer" | "repertorio" | null>(null);
  const pendingModeSwitchRef = useRef<"tocar" | "componer" | "repertorio" | null>(null);
  const omittedReminderFpRef = useRef<string | null>(null);
  const [recoveryDraftV2, setRecoveryDraftV2] = useState<DraftRecoveryV2 | null>(null);
  const draftDebounceV2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transposeRef = useRef(0);
  const selectedSavedRef = useRef(selectedSaved);
  const undoStackV2Ref = useRef<SongDocV2[]>([]);
  const redoStackV2Ref = useRef<SongDocV2[]>([]);
  const skipUndoPushV2Ref = useRef(false);
  const docV2Ref = useRef<SongDocV2>(docV2);
  const requestCloseRef = useRef<() => Promise<void>>(async () => {});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    docV2Ref.current = docV2;
  }, [docV2]);

  useEffect(() => {
    selectedSavedRef.current = selectedSaved;
  }, [selectedSaved]);

  useEffect(() => {
    setSavedNames(listSongNames());
    setAllSongs(listSongsWithCategories());
    setCategories(listCategories());
  }, []);

  useEffect(() => {
    const d2 = loadDraftV2();
    const draftV2Valid =
      d2 &&
      (d2.savedName || normalizeSongDocV2(d2.doc).events.some((e) => e.kind === "note"));

    if (!draftV2Valid && d2) clearDraftV2();
    if (draftV2Valid) setRecoveryDraftV2(d2!);
  }, []);

  const [isElectron, setIsElectron] = useState(false);
  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!(window as any).electron);
  }, []);

  useEffect(() => {
    const el = (typeof window !== "undefined" && (window as any).electron) as { onCloseRequest?: (cb: () => void) => void } | undefined;
    if (!el?.onCloseRequest) return;
    el.onCloseRequest(() => {
      void requestCloseRef.current?.();
    });
  }, []);

  const { ready: pianoReady, play } = usePiano();
  const [transpose, setTranspose] = useState<number>(0);

  useEffect(() => {
    transposeRef.current = transpose;
  }, [transpose]);

  const [mode, setMode] = useState<"tocar" | "componer" | "repertorio">("tocar");

  function countNotes(d: SongDocV2): number {
    return normalizeSongDocV2(d).events.filter((e) => e.kind === "note").length;
  }

  function isDirtyNow(): boolean {
    if (!baselineFpV2Ref.current) return false;
    return docFingerprintV2(docV2Ref.current, transposeRef.current) !== baselineFpV2Ref.current;
  }

  function hasContentNow(): boolean {
    return !!selectedSavedRef.current || countNotes(docV2Ref.current) > 0;
  }

  useEffect(() => {
    const fp2 = docFingerprintV2(docV2, transpose);
    setBaselineFpV2((cur) => (cur ? cur : fp2));
    baselineFpV2Ref.current = baselineFpV2Ref.current || fp2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = useMemo(() => {
    if (!baselineFpV2) return false;
    return docFingerprintV2(docV2, transpose) !== baselineFpV2;
  }, [docV2, transpose, baselineFpV2]);

  const flatSongV2 = useMemo(() => flattenDocV2ForPlay(docV2), [docV2]);

  const v2Playability = useMemo(
    () => analyzePlayability(docV2, { visibleOnly: true }),
    [docV2]
  );

  const flatSongV2NoteCount = useMemo(() => countNotes(docV2), [docV2]);

  useEffect(() => {
    if (mode !== "componer") return;
    if (!hasContentNow() || !isDirtyNow()) return;
    if (draftDebounceV2Ref.current) clearTimeout(draftDebounceV2Ref.current);
    draftDebounceV2Ref.current = setTimeout(() => {
      draftDebounceV2Ref.current = null;
      saveDraftV2(docV2Ref.current, transposeRef.current, selectedSavedRef.current);
    }, 1000);
    return () => {
      if (draftDebounceV2Ref.current) clearTimeout(draftDebounceV2Ref.current);
    };
  }, [mode, docV2, transpose, selectedSaved, isDirty]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (mode === "componer" && hasContentNow() && isDirtyNow()) {
        saveDraftV2(docV2Ref.current, transposeRef.current, selectedSavedRef.current);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mode, docV2, transpose, selectedSaved, isDirty]);

  async function confirmLoseChanges(actionLabel: string): Promise<boolean> {
    if (mode !== "componer") return true;
    if (!isDirtyNow()) return true;
    if (!hasContentNow()) return true;
    return await askConfirm(`La canción actual tiene cambios sin guardar.\n\n¿Continuar con "${actionLabel}" y perder los cambios?`);
  }

  async function confirmLoseAnyUnsaved(actionLabel: string): Promise<boolean> {
    if (isDirtyNow() && hasContentNow()) {
      const ok = await askConfirm(
        `Hay cambios sin guardar en Componer.\n\n¿Continuar con "${actionLabel}" y perder los cambios?`
      );
      if (!ok) return false;
    }
    return true;
  }

  const displaySong = useMemo<NoteEvent[]>(() => {
    const source = v2Playability.playable ? flatSongV2.events : [];
    if (!transpose) return source;
    return source.map((ev) => {
      if (ev.note === "—" || ev.note === "SPACE" || ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO") {
        return ev;
      }
      const shownNote = shiftNote(ev.note, -transpose);
      const f = getFingeringForNote(shownNote as NoteId, EMPTY);
      const snapshot: Fingering = typeof structuredClone === "function" ? structuredClone(f) : { ...f };
      return { ...ev, note: shownNote, fingering: snapshot };
    });
  }, [flatSongV2.events, v2Playability.playable, transpose]);

  const playBlocked = useMemo(() => {
    if (!selectedSaved && flatSongV2NoteCount === 0) return null;
    if (v2Playability.playable) return null;
    return {
      reason: "Esta canción tiene notas superpuestas. Abrila en Componer para corregirla.",
      conflictCount: v2Playability.conflicts.length,
    };
  }, [selectedSaved, flatSongV2NoteCount, v2Playability]);

  const playSections = useMemo(() => {
    const byId = new Map(displaySong.map((ev) => [ev.id, ev]));
    return flatSongV2.playSections.map((sec) => ({
      instanceId: sec.instanceId,
      name: sec.name,
      events: sec.events.map((e) => byId.get(e.id)).filter(Boolean) as NoteEvent[],
    }));
  }, [flatSongV2.playSections, displaySong]);

  function incTranspose() {
    setTranspose((t) => t + 1);
  }
  function decTranspose() {
    setTranspose((t) => t - 1);
  }

  function flatNotesStringFromStore(notes: string[]): string {
    return (notes || []).join(" ");
  }

  async function handleDownloadRepertorio() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const example = `compendio_ocarina_${yyyy}-${mm}-${dd}_${hh}_${min}.json`;
    const input = await askPrompt("Exportar compendio", "Nombre de archivo", example);
    if (input == null) return;
    const chosen = sanitizeFilename((input ?? "").trim()) || example;
    const finalName = chosen.toLowerCase().endsWith(".json") ? chosen : `${chosen}.json`;
    setExportLoading(true);
    try {
      downloadBundle(finalName);
    } finally {
      setTimeout(() => setExportLoading(false), 300);
    }
  }

  async function handleImportRepertorioFile(file: File) {
    if (!file) return;
    try {
      setImportLoading(true);
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      function baseRootName(name: string): string {
        const trimmed = (name || "").trim();
        if (!trimmed) return "Canción";
        const m = trimmed.match(/^(.*?)(?:\s+(\d+))$/);
        const root = (m?.[1] || trimmed).trim();
        return root || "Canción";
      }

      function suggestUniqueName(root: string): string {
        const base = baseRootName(root);
        let i = 1;
        while (true) {
          const cand = `${base} ${i}`;
          if (!hasSong(cand)) return cand;
          i++;
        }
      }

      async function askSaveAsName(existingName: string): Promise<string | null> {
        let proposed = suggestUniqueName(existingName);
        while (true) {
          const input = await askPrompt("Guardar con otro nombre", "Nuevo nombre", proposed);
          if (input == null) return null;
          const trimmed = (input || "").trim();
          if (!trimmed) {
            showToast("Nombre inválido.");
            continue;
          }
          if (hasSong(trimmed)) {
            showToast(`La canción "${trimmed}" ya existe.`);
            proposed = suggestUniqueName(trimmed);
            continue;
          }
          return trimmed;
        }
      }

      const result = await importCompendiumParsed(parsed, {
        hasSong,
        askImportChoice,
        askSaveAsName,
      });

      setSavedNames(listSongNames());
      setAllSongs(listSongsWithCategories());
      setCategories(listCategories());
      setSelectedSaved("");

      if (result.imported === 0) {
        showToast(result.skipped > 0 ? "No se importaron canciones nuevas" : "No se importaron canciones");
      } else if (result.migrated > 0) {
        showToast(`Importadas ${result.imported} canciones (${result.migrated} migradas desde formato legacy)`);
      } else {
        showToast(`Importadas ${result.imported} canciones`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setErrorMsg(msg || "No se pudo leer el archivo de compendio.");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleImportSongCode(code: string) {
    const { parsed } = await parseShareCode(code);
    await handleImportRepertorioFile(
      new File([JSON.stringify(parsed)], "codigo.json", { type: "application/json" })
    );
  }

  async function handleUploadRepertorio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImportRepertorioFile(file);
    e.currentTarget.value = "";
  }

  function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim().replace(/\s/g, "_");
  }

  function removeEvent(id: string) {
    const ref = flatSongV2.idToRef[id];
    if (!ref) return;
    setDocV2((cur) =>
      patchSongDocV2(cur, (d) => {
        d.events = d.events.filter((x) => x.id !== ref.itemId);
      })
    );
    setSelectedPlayId((cur) => (cur === id ? null : cur));
  }

  function reorderEvent(_sourceId: string, _targetIndex: number) {
    // TODO: reordenamiento en modo tocar se actualizará luego (por ahora no-op)
  }

  function showToast(message: string, durationMs = 2500) {
    setToast(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, durationMs);
  }

  function refreshSongs() {
    setSavedNames(listSongNames());
    setAllSongs(listSongsWithCategories());
    setCategories(listCategories());
  }

  function askConfirm(message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmMsg(message);
    });
  }

  function applyLoadedSong(name: string): boolean {
    const t = getSongTranspose(name);
    const fmt = getSongDocFormat(name);
    setSelectedPlayId(null);
    setTranspose(t);
    setSelectedSaved(name);

    let loaded: SongDocV2;
    if (fmt === "v2") {
      const fromStore = loadSongDocV2(name);
      if (!fromStore) return false;
      loaded = fromStore;
    } else {
      const legacy = loadSongDoc(name);
      if (!legacy) return false;
      loaded = migrateV1ToV2(legacy, t);
    }

    setDocV2(loaded);
    omittedReminderFpRef.current = null;
    undoStackV2Ref.current = [];
    redoStackV2Ref.current = [];
    const fp = docFingerprintV2(loaded, t);
    baselineFpV2Ref.current = fp;
    setBaselineFpV2(fp);
    return true;
  }

  function performSave(name: string, category: string, subcategory: string) {
    const docToSave = normalizeSongDocV2(docV2Ref.current);
    const t = transposeRef.current;
    saveSongDocV2(name, docToSave, t, category, subcategory);
    clearDraftV2();
    const fp = docFingerprintV2(docToSave, t);
    baselineFpV2Ref.current = fp;
    justSavedRef.current = true;
    setBaselineFpV2(fp);
    setDocV2(docToSave);
    const names = listSongNames();
    setSavedNames(names);
    setSelectedSaved(name);
    selectedSavedRef.current = name;
    setAllSongs(listSongsWithCategories());
    setCategories(listCategories());
    showToast("Canción guardada");
    if (pendingModeSwitchRef.current) {
      setMode(pendingModeSwitchRef.current);
      pendingModeSwitchRef.current = null;
    }
  }

  const handleOpenSave = useCallback(() => {
    if (countNotes(docV2Ref.current) === 0) {
      pendingModeSwitchRef.current = null;
      showToast("La canción está vacía");
      return;
    }
    if (selectedSavedRef.current) {
      void (async () => {
        const ok = await askConfirm("¿Quieres sobrescribir esta canción?");
        if (!ok) {
          pendingModeSwitchRef.current = null;
          return;
        }
        const meta = allSongs.find((s) => s.name === selectedSavedRef.current);
        performSave(selectedSavedRef.current, meta?.category ?? "", meta?.subcategory ?? "");
      })();
      return;
    }
    setSaveOpen(true);
  }, [allSongs]);

  function handleDocChangeFromComposer(next: SongDocV2) {
    if (skipUndoPushV2Ref.current) {
      skipUndoPushV2Ref.current = false;
      setDocV2(next);
      return;
    }
    const current = docV2Ref.current;
    undoStackV2Ref.current.push(structuredClone(current));
    redoStackV2Ref.current = [];
    while (undoStackV2Ref.current.length > MAX_UNDO_STACK_SIZE) {
      undoStackV2Ref.current.shift();
    }
    setDocV2(next);
  }

  function handleUndo() {
    if (undoStackV2Ref.current.length === 0) {
      showToast("No hay pasos anteriores");
      return;
    }
    const prev = undoStackV2Ref.current.pop()!;
    redoStackV2Ref.current.push(structuredClone(docV2Ref.current));
    skipUndoPushV2Ref.current = true;
    setDocV2(prev);
    showToast("Deshecho");
  }

  function handleRedo() {
    if (redoStackV2Ref.current.length === 0) {
      showToast("No hay pasos posteriores");
      return;
    }
    const next = redoStackV2Ref.current.pop()!;
    undoStackV2Ref.current.push(structuredClone(docV2Ref.current));
    skipUndoPushV2Ref.current = true;
    setDocV2(next);
    showToast("Rehecho");
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as any)?.isContentEditable) return;
      if (mode === "componer") {
        if (matchesKeyBinding(e, APP_KEY_BINDINGS.save)) {
          e.preventDefault();
          handleOpenSave();
        }
        if (matchesKeyBinding(e, APP_KEY_BINDINGS.undo)) {
          e.preventDefault();
          handleUndo();
        }
        if (matchesKeyBinding(e, APP_KEY_BINDINGS.redo)) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, handleOpenSave]);

  function handleModeChange(newMode: "tocar" | "componer" | "repertorio") {
    if (justSavedRef.current) {
      justSavedRef.current = false;
      setMode(newMode);
      return;
    }
    if (mode === "componer") {
      if (isDirtyNow() && newMode !== "componer" && hasContentNow()) {
        const currentFp = docFingerprintV2(docV2Ref.current, transposeRef.current);
        if (omittedReminderFpRef.current === currentFp) {
          setMode(newMode);
          return;
        }
        setPendingModeSwitch(newMode);
        setUnsavedReminderOpen(true);
        return;
      }
    }
    setMode(newMode);
  }

  function askPrompt(title: string, label: string, initial: string): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      setPromptState({ open: true, title, label, initial });
      promptResolverRef.current = resolve;
    });
  }

  function askImportChoice(message: string): Promise<"overwrite" | "rename" | "skip"> {
    return new Promise<"overwrite" | "rename" | "skip">((resolve) => {
      importChoiceResolverRef.current = resolve;
      setImportChoiceMsg(message);
    });
  }
  function handleSelectEvent(id: string) {
    // Si clickean la misma nota ya seleccionada o llega vacío, desseleccionar y no sonar
    if (!id || id === selectedPlayId) {
      setSelectedPlayId(null);
      return;
    }
    setSelectedPlayId(id);
    const ev = displaySong.find((x) => x.id === id);
    if (!ev) return;
    if (ev.note === "—" || ev.note === "SPACE" || ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO") {
      return;
    }
    // reproducir la nota tal como se ve (ya transpuesta en displaySong)
    play(ev.note, 0.6);
  }

  requestCloseRef.current = async () => {
    const ok =
      mode === "componer"
        ? await confirmLoseChanges("Cerrar")
        : await confirmLoseAnyUnsaved("Cerrar");
    if (!ok) return;
    if (mode === "componer" && hasContentNow() && isDirtyNow()) {
      saveDraftV2(docV2Ref.current, transposeRef.current, selectedSavedRef.current);
    }
    (window as any).electron?.close();
  };

  const titleBarHeight = isElectron ? 37 : 0; // 36px + 1px border
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TitleBar onCloseClick={() => void requestCloseRef.current?.()} />
      {/* Contenedor de scroll a ancho completo: la barra queda al borde y los espacios vacíos scrollean con el contenido */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflow: "auto",
          boxSizing: "border-box",
        }}
      >
        <main
          style={{
            paddingTop: titleBarHeight ? titleBarHeight + 20 : 20,
            paddingRight: 20,
            paddingBottom: 20,
            paddingLeft: 100,
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
      <ModeSidebar
        mode={mode}
        onModeChange={handleModeChange}
        noteLabelMode={noteLabelMode}
        onToggleNotation={() => setNoteLabelMode((m) => (m === "latin" ? "letter" : "latin"))}
        titleBarOffset={isElectron ? 37 : 0}
      />

      <div>
        {mode === "repertorio" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              height: isElectron ? "calc(100vh - 37px - 40px - 2px)" : "calc(100vh - 40px - 2px)",
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, minHeight: 0 }}>
              <CompendiumManager
                songs={allSongs}
                categories={categories}
                onRefresh={refreshSongs}
                hasSong={hasSong}
                onExportAll={handleDownloadRepertorio}
                onImportFile={handleImportRepertorioFile}
                onImportSongCode={handleImportSongCode}
                onClearAll={async () => {
                  const input = await askPrompt(
                    "Borrar compendio",
                    'Escribí "COMPENDIO" para confirmar.\n\nEsto va a borrar TODAS las canciones actuales y no se puede deshacer.',
                    ""
                  );
                  if (input == null) return;
                  if ((input || "").trim() !== "COMPENDIO") {
                    showToast("Confirmación inválida. No se borró nada.");
                    return;
                  }
                  clearAllSongs();
                  setSelectedSaved("");
                  setAllSongs([]);
                  setCategories([]);
                  setSavedNames([]);
                  showToast("Compendio borrado.");
                }}
                onDeleteSong={async (name) => {
                  const trimmed = (name || "").trim();
                  if (!trimmed) return;
                  removeSong(trimmed);
                  refreshSongs();
                  setSelectedSaved((cur) => (cur === trimmed ? "" : cur));
                  showToast("Canción borrada.");
                }}
                onDeleteCategory={async (categoryName) => {
                  const cat = (categoryName || "").trim();
                  if (!cat) return;
                  const key = cat === "Otros" ? "" : cat;
                  const toDelete = listSongsWithCategories().filter((s) => (s.category || "").trim() === (key || "").trim()).map((s) => s.name);
                  for (const n of toDelete) removeSong(n);
                  refreshSongs();
                  if (toDelete.includes(selectedSaved)) setSelectedSaved("");
                  showToast("Categoría borrada (canciones eliminadas).");
                }}
                onDeleteSubcategory={async (subcategoryName) => {
                  const sub = (subcategoryName || "").trim();
                  if (!sub) return;
                  const key = sub === "Sin subcategoría" ? "" : sub;
                  const toDelete = listSongsWithCategories().filter((s) => (s.subcategory || "").trim() === (key || "").trim()).map((s) => s.name);
                  for (const n of toDelete) removeSong(n);
                  refreshSongs();
                  if (toDelete.includes(selectedSaved)) setSelectedSaved("");
                  showToast("Subcategoría borrada (canciones eliminadas).");
                }}
                askConfirm={askConfirm}
                showToast={showToast}
                renameCategory={async (from, to) => {
                  renameCategory(from, to);
                }}
                renameSubcategory={async (from, to) => {
                  renameSubcategory(from, to);
                }}
                renameSong={async (from, to) => {
                  renameSong(from, to);
                  // si era la seleccionada, mantener el nombre seleccionado
                  setSelectedSaved((cur) => (cur === from ? to : cur));
                }}
                setSongCategory={async (name, category) => {
                  setSongCategory(name, category);
                }}
                setSongSubcategory={async (name, subcategory) => {
                  setSongSubcategory(name, subcategory);
                }}
              />
            </div>
          </div>
        ) : mode === "tocar" ? (
          <PlayMode
            scrollContainerRef={scrollContainerRef}
            stickyTopOffset={12 + titleBarHeight}
            selectedSaved={selectedSaved}
            savedNamesCount={savedNames.length}
            onOpenPicker={() => setPickerOpen(true)}
            sections={playBlocked ? [] : playSections}
            selectedId={selectedPlayId}
            onSelectEvent={handleSelectEvent}
            onRemoveEvent={removeEvent}
            onReorderEvent={reorderEvent}
            noteLabelMode={noteLabelMode}
            playBlocked={playBlocked}
          />
        ) : mode === "componer" ? (
          <ComposeMode
            stickyTopOffset={12 + titleBarHeight}
            notes={NOTES}
            noteLabelMode={noteLabelMode}
            doc={docV2}
            onDocChange={handleDocChangeFromComposer}
            transpose={transpose}
            onTransposeDec={decTranspose}
            onTransposeInc={incTranspose}
            onPreviewNote={(n) => play(n, 0.6)}
            selectedSaved={selectedSaved}
            savedNamesCount={savedNames.length}
            songLength={flatSongV2NoteCount}
            onNewSong={() => {
              void (async () => {
                const ok = await confirmLoseChanges("Nueva canción");
                if (!ok) return;
                const fresh = createEmptySongDocV2();
                setDocV2(fresh);
                omittedReminderFpRef.current = null;
                undoStackV2Ref.current = [];
                redoStackV2Ref.current = [];
                setSelectedPlayId(null);
                setSelectedSaved("");
                setTranspose(0);
                const fp = docFingerprintV2(fresh, 0);
                baselineFpV2Ref.current = fp;
                setBaselineFpV2(fp);
              })();
            }}
            onOpenSave={handleOpenSave}
            onOpenPicker={() => setPickerOpen(true)}
            onDeleteSaved={async () => {
              if (!selectedSaved) return;
              const ok = await askConfirm(`¿Eliminar "${selectedSaved}" de la memoria?`);
              if (!ok) return;
              removeSong(selectedSaved);
              const names = listSongNames();
              setSavedNames(names);
              setSelectedSaved("");
              setAllSongs(listSongsWithCategories());
              setCategories(listCategories());
            }}
            onOpenRename={() => setRenameOpen(true)}
          />
        ) : null}
        <SongPickerSidebar
          open={pickerOpen}
          songs={allSongs}
          onClose={() => setPickerOpen(false)}
          onPick={async (name) => {
            if (mode === "componer") {
              if (name !== selectedSaved) {
                const ok = await confirmLoseChanges(`Seleccionar "${name}"`);
                if (!ok) return false;
              }
            } else if (name !== selectedSaved) {
              const ok = await confirmLoseAnyUnsaved(`Seleccionar "${name}"`);
              if (!ok) return false;
            }
            return applyLoadedSong(name);
          }}
        />
        <SaveSongModal
          open={saveOpen}
          initialName={selectedSaved || ""}
          categories={categories}
          initialCategory={(allSongs.find((s) => s.name === selectedSaved)?.category || "")}
          initialSubcategory={(allSongs.find((s) => s.name === selectedSaved)?.subcategory || "")}
          existingNames={savedNames}
          onCancel={() => setSaveOpen(false)}
          onSave={(name, category, subcategory) => {
            if (countNotes(docV2Ref.current) === 0) return;
            performSave(name, category, subcategory);
            setSaveOpen(false);
          }}
        />
        <RenameSongModal
          open={renameOpen}
          initialName={selectedSaved || ""}
          initialCategory={allSongs.find((s) => s.name === selectedSaved)?.category ?? ""}
          initialSubcategory={allSongs.find((s) => s.name === selectedSaved)?.subcategory ?? ""}
          categories={categories}
          onCancel={() => setRenameOpen(false)}
          onSave={async (newName, category, subcategory) => {
            const trimmed = (newName || "").trim();
            if (!trimmed) return;
            if (!selectedSaved) {
              setRenameOpen(false);
              return;
            }
            if (selectedSaved !== trimmed && hasSong(trimmed)) {
              const ok = await askConfirm(`La canción "${trimmed}" ya existe. ¿Sobrescribir?`);
              if (!ok) return;
            }
            if (selectedSaved !== trimmed) {
              renameSong(selectedSaved, trimmed);
            }
            const finalName = trimmed;
            setSongCategory(finalName, category);
            setSongSubcategory(finalName, subcategory);
            const names = listSongNames();
            setSavedNames(names);
            setSelectedSaved(finalName);
            setAllSongs(listSongsWithCategories());
            setCategories(listCategories());
            setRenameOpen(false);
            showToast("Canción actualizada");
          }}
        />
      </div>
      <ErrorModal open={!!errorMsg} message={errorMsg || ""} onClose={() => setErrorMsg(null)} />
      {unsavedReminderOpen && pendingModeSwitch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1150,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-reminder-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 380px)",
              background: "#1f1f1f",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 16,
              display: "grid",
              gap: 14,
            }}
          >
            <div id="unsaved-reminder-title" style={{ fontWeight: 900, fontSize: 16 }}>
              No guardaste tu canción, ¿querés guardarla?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  omittedReminderFpRef.current = docFingerprintV2(docV2Ref.current, transposeRef.current);
                  setUnsavedReminderOpen(false);
                  setMode(pendingModeSwitch);
                  setPendingModeSwitch(null);
                }}
                style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Omitir
              </button>
              <button
                onClick={() => {
                  setUnsavedReminderOpen(false);
                  pendingModeSwitchRef.current = pendingModeSwitch;
                  setPendingModeSwitch(null);
                  handleOpenSave();
                }}
                style={{ padding: "8px 12px", borderRadius: 10, background: "#2b7a1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!confirmMsg}
        message={confirmMsg || ""}
        onCancel={() => {
          setConfirmMsg(null);
          confirmResolverRef.current?.(false);
        }}
        onConfirm={() => {
          setConfirmMsg(null);
          confirmResolverRef.current?.(true);
        }}
      />
      {recoveryDraftV2 ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1163,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recovery-v2-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 420px)",
              background: "#1f1f1f",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div id="recovery-v2-title" style={{ fontWeight: 900, fontSize: 16 }}>Recuperar canción</div>
            <div style={{ opacity: 0.9, whiteSpace: "pre-line" }}>
              Tenés un borrador sin guardar de la última sesión. ¿Abrir?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  clearDraftV2();
                  setRecoveryDraftV2(null);
                }}
                style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Descartar
              </button>
              <button
                onClick={() => {
                  const d = recoveryDraftV2;
                  if (!d) return;
                  setDocV2(d.doc);
                  setTranspose(d.transpose);
                  setSelectedSaved(d.savedName);
                  setMode("componer");
                  const fp = docFingerprintV2(d.doc, d.transpose);
                  baselineFpV2Ref.current = fp;
                  setBaselineFpV2(fp);
                  undoStackV2Ref.current = [];
                  redoStackV2Ref.current = [];
                  clearDraftV2();
                  setRecoveryDraftV2(null);
                  showToast("Canción recuperada");
                }}
                style={{ padding: "8px 12px", borderRadius: 10, background: "#2b7a1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Abrir
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {importChoiceMsg ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1165,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setImportChoiceMsg(null);
            importChoiceResolverRef.current?.("skip");
          }}
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>La canción ya existe</div>
              <button
                onClick={() => {
                  setImportChoiceMsg(null);
                  importChoiceResolverRef.current?.("skip");
                }}
                style={{ marginLeft: "auto", background: "none", color: "#eaeaea", border: "none", fontSize: 18, cursor: "pointer" }}
                aria-label="Cerrar"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
            <div style={{ opacity: 0.9, whiteSpace: "pre-line" }}>{importChoiceMsg}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setImportChoiceMsg(null);
                  importChoiceResolverRef.current?.("skip");
                }}
                style={{ padding: "8px 12px", borderRadius: 10, background: "transparent", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Omitir
              </button>
              <button
                onClick={() => {
                  setImportChoiceMsg(null);
                  importChoiceResolverRef.current?.("rename");
                }}
                style={{ padding: "8px 12px", borderRadius: 10, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Guardar con otro nombre
              </button>
              <button
                onClick={() => {
                  setImportChoiceMsg(null);
                  importChoiceResolverRef.current?.("overwrite");
                }}
                style={{ padding: "8px 12px", borderRadius: 10, background: "#7a1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Sobrescribir
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {promptState && (
        <PromptModal
          open={true}
          title={promptState.title}
          label={promptState.label}
          initialValue={promptState.initial}
          onCancel={() => {
            setPromptState(null);
            promptResolverRef.current?.(null);
          }}
          onSubmit={(val) => {
            setPromptState(null);
            promptResolverRef.current?.(val);
          }}
        />
      )}
      <LoadingModal open={exportLoading} title="Generando archivo…" />
      <LoadingModal open={importLoading} title="Importando compendio…" />
      {toast && (
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
            padding: "10px 12px",
            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
            fontSize: 14,
          }}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
      </main>
      </div>
    </div>
  );
}
