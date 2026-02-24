"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import ModeSidebar from "@/components/ModeSidebar";
import ComposeMode from "@/components/modes/ComposeMode";
import PlayMode from "@/components/modes/PlayMode";
import RepertoireMode from "@/components/modes/RepertoireMode";
import type { Fingering, HoleId, NoteEvent, NoteId } from "@/lib/types";
import { getFingeringForNote, EMPTY, hasFingeringForNote } from "@/lib/fingerings";
import { buildChromaticRange, shiftNote } from "@/lib/notes";
import type { NoteLabelMode } from "@/lib/noteLabels";
import { createEmptySongDoc, songDocFromStorage, type SongDoc } from "@/lib/songDoc";
import { listSongNames, saveSongDoc, loadSongDoc, removeSong, hasSong, downloadBundle, getSongTranspose, clearAllSongs, listSongsWithCategories, listCategories, renameSong } from "@/lib/songStore";
import SongPickerSidebar from "@/components/SongPickerSidebar";
import SaveSongModal from "@/components/SaveSongModal";
import RenameSongModal from "@/components/RenameSongModal";
import { usePiano } from "@/lib/usePiano";
import ErrorModal from "@/components/ErrorModal";
import ConfirmModal from "@/components/ConfirmModal";
import PromptModal from "@/components/PromptModal";
import LoadingModal from "@/components/LoadingModal";

export default function Page() {
  // Podés cambiar esto por el rango real de tu ocarina
  const NOTES = useMemo(() => buildChromaticRange({ from: "C4", to: "C6" }), []);

  const [doc, setDoc] = useState<SongDoc>(() => createEmptySongDoc());
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
  const [promptState, setPromptState] = useState<{ open: boolean; title: string; label: string; initial: string } | null>(null);
  const promptResolverRef = useRef<(val: string | null) => void>();
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [baselineFp, setBaselineFp] = useState<string>(() => "");

  useEffect(() => {
    setSavedNames(listSongNames());
    setAllSongs(listSongsWithCategories());
    setCategories(listCategories());
  }, []);

  const { ready: pianoReady, play } = usePiano();
  const [transpose, setTranspose] = useState<number>(0);
  const [testMode, setTestMode] = useState<boolean>(false);
  const [freeMode, setFreeMode] = useState<boolean>(false);
  const [mode, setMode] = useState<"tocar" | "componer" | "repertorio">("tocar");
  const fileRef = useRef<HTMLInputElement>(null);

  function docFingerprint(d: SongDoc, t: number): string {
    const sections = Object.keys(d.sectionsById)
      .sort((a, b) => a.localeCompare(b))
      .map((id) => {
        const s = d.sectionsById[id];
        return { id, name: s?.name ?? "", notes: (s?.items || []).map((it) => it.note) };
      });
    const arrangement = (d.arrangement || []).map((x) => x.sectionId);
    return JSON.stringify({ v: 1, t, arrangement, sections });
  }

  useEffect(() => {
    // baseline inicial = estado inicial de doc+transpose
    setBaselineFp((cur) => (cur ? cur : docFingerprint(doc, transpose)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = useMemo(() => {
    if (!baselineFp) return false;
    return docFingerprint(doc, transpose) !== baselineFp;
  }, [doc, transpose, baselineFp]);

  async function confirmLoseChanges(actionLabel: string): Promise<boolean> {
    if (mode !== "componer") return true;
    if (!isDirty) return true;
    return await askConfirm(`La canción actual tiene cambios sin guardar.\n\n¿Continuar con "${actionLabel}" y perder los cambios?`);
  }

  const flatSong = useMemo(() => {
    const events: NoteEvent[] = [];
    const idToRef: Record<string, { sectionId: string; itemId: string }> = {};
    for (const inst of doc.arrangement) {
      const sec = doc.sectionsById[inst.sectionId];
      if (!sec) continue;
      for (const item of sec.items) {
        const id = `${inst.id}:${item.id}`;
        idToRef[id] = { sectionId: sec.id, itemId: item.id };
        const baseNote = item.note;
        const baseF = getFingeringForNote(baseNote as NoteId, EMPTY);
        const snapshot: Fingering = typeof structuredClone === "function" ? structuredClone(baseF) : { ...baseF };
        events.push({ id, note: baseNote as any, fingering: snapshot });
      }
    }
    return { events, idToRef };
  }, [doc]);

  const displaySong = useMemo<NoteEvent[]>(() => {
    if (!transpose) return flatSong.events;
    return flatSong.events.map((ev) => {
      if (ev.note === "—" || ev.note === "SPACE" || ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO") {
        return ev;
      }
      const shownNote = shiftNote(ev.note, -transpose);
      const f = getFingeringForNote(shownNote as NoteId, EMPTY);
      const snapshot: Fingering = typeof structuredClone === "function" ? structuredClone(f) : { ...f };
      return { ...ev, note: shownNote, fingering: snapshot };
    });
  }, [flatSong.events, transpose]);

  const playSections = useMemo(() => {
    const byId = new Map<string, NoteEvent>();
    for (const ev of displaySong) byId.set(ev.id, ev);
    return doc.arrangement
      .map((inst) => {
        const sec = doc.sectionsById[inst.sectionId];
        if (!sec) return null;
        const events = sec.items
          .map((it) => byId.get(`${inst.id}:${it.id}`))
          .filter(Boolean) as NoteEvent[];
        return { instanceId: inst.id, name: sec.name, events };
      })
      .filter(Boolean) as Array<{ instanceId: string; name: string; events: NoteEvent[] }>;
  }, [doc, displaySong]);

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
    const example = `repertorio_ocarina_${yyyy}-${mm}-${dd}_${hh}_${min}.json`;
    const input = await askPrompt("Descargar repertorio", "Nombre de archivo", example);
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

  async function handleUploadRepertorio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportLoading(true);
      const text = await file.text();
      const parsed = JSON.parse(text) as any;
      let songsAny: any = null;
      if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 6 && parsed.songs) {
        songsAny = parsed.songs;
      } else if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 5 && parsed.songs) {
        songsAny = parsed.songs as Record<string, { notes: string[]; transpose?: number }>;
      } else if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 4 && parsed.songs) {
        songsAny = parsed.songs as Record<string, { notes: string[]; transpose?: number }>;
      } else if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 3 && parsed.songs) {
        songsAny = parsed.songs as Record<string, { notes: string[]; transpose?: number }>;
      } else if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 2 && parsed.songs) {
        songsAny = parsed.songs; // { name: { notes: [...] } }
      } else if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 1 && parsed.songs) {
        songsAny = parsed.songs; // legacy { name: NoteEvent[] }
      } else if (parsed && typeof parsed === "object") {
        songsAny = parsed; // could be plain map
      }
      if (!songsAny || typeof songsAny !== "object") {
        setErrorMsg("Archivo inválido.");
        return;
      }

      function flattenNotesFromDoc(d: SongDoc): string[] {
        const out: string[] = [];
        for (const inst of d.arrangement) {
          const sec = d.sectionsById[inst.sectionId];
          if (!sec) continue;
          for (const it of sec.items) out.push(it.note);
        }
        return out;
      }

      function docFromNotes(notes: string[]): SongDoc {
        // Build via storage roundtrip for simplicity
        const realSid = nanoid();
        return songDocFromStorage({
          sections: { [realSid]: { name: "General", notes: notes || [] } },
          arrangement: [{ sectionId: realSid }],
        });
      }

      let imported = 0;
      for (const [name, payload] of Object.entries(songsAny)) {
        const trimmed = (name || "").trim();
        if (!trimmed) continue;

        let incomingDoc: SongDoc | null = null;
        let incomingTranspose: number = 0;
        let incomingCategory: string = "";
        let incomingSubcategory: string = "";

        if (payload && Array.isArray(payload)) {
          const incomingNotes = (payload as any[]).map((e) => (e && typeof e === "object" ? (e as any).note : null)).filter(Boolean) as string[];
          incomingDoc = docFromNotes(incomingNotes);
        } else if (payload && typeof payload === "object") {
          if ((payload as any).sections && (payload as any).arrangement) {
            incomingDoc = songDocFromStorage({ sections: (payload as any).sections, arrangement: (payload as any).arrangement });
          } else if (Array.isArray((payload as any).notes)) {
            incomingDoc = docFromNotes((payload as any).notes as string[]);
          }
          if (typeof (payload as any).transpose === "number") incomingTranspose = (payload as any).transpose as number;
          if (typeof (payload as any).category === "string") incomingCategory = (payload as any).category as string;
          if (typeof (payload as any).subcategory === "string") incomingSubcategory = (payload as any).subcategory as string;
        }
        if (!incomingDoc) continue;

        const existingDoc = loadSongDoc(trimmed);
        const a = existingDoc ? flatNotesStringFromStore(flattenNotesFromDoc(existingDoc)) : "";
        const b = flatNotesStringFromStore(flattenNotesFromDoc(incomingDoc));

        if (!existingDoc) {
          saveSongDoc(trimmed, incomingDoc, incomingTranspose, incomingCategory, incomingSubcategory);
          imported++;
          continue;
        }

        if (a === b) {
          continue;
        }
        const ok = await askConfirm(`La canción "${trimmed}" ya existe.\n\nActual:\n${a}\n\nNueva:\n${b}\n\n¿Sobrescribir?`);
        if (ok) {
          saveSongDoc(trimmed, incomingDoc, incomingTranspose, incomingCategory, incomingSubcategory);
          imported++;
        }
      }
      setSavedNames(listSongNames());
      setSelectedSaved("");
      showToast(`Importadas ${imported} canciones`);
    } catch (err) {
      setErrorMsg("No se pudo leer el archivo de repertorio.");
    } finally {
      setImportLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim().replace(/\s/g, "_");
  }

  function removeEvent(id: string) {
    const ref = flatSong.idToRef[id];
    if (!ref) return;
    setDoc((cur) => {
      const next: SongDoc = { ...cur, sectionsById: structuredClone(cur.sectionsById), arrangement: cur.arrangement.map((x) => ({ ...x })) };
      const sec = next.sectionsById[ref.sectionId];
      if (!sec) return cur;
      sec.items = sec.items.filter((x) => x.id !== ref.itemId);
      return next;
    });
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

  function askConfirm(message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmMsg(message);
    });
  }

  function askPrompt(title: string, label: string, initial: string): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      setPromptState({ open: true, title, label, initial });
      promptResolverRef.current = resolve;
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

  return (
    <main style={{ padding: 20, paddingLeft: 100, maxWidth: 1200, margin: "0 auto" }}>
      <ModeSidebar
        mode={mode}
        onModeChange={setMode}
        noteLabelMode={noteLabelMode}
        onToggleNotation={() => setNoteLabelMode((m) => (m === "latin" ? "letter" : "latin"))}
      />

      <div>
        {mode === "repertorio" ? (
          <RepertoireMode
            fileRef={fileRef}
            onDownload={handleDownloadRepertorio}
            onUploadClick={() => fileRef.current?.click()}
            onClear={async () => {
              const ok = await askConfirm("¿Borrar todo el repertorio guardado? Esta acción no se puede deshacer.");
              if (!ok) return;
              clearAllSongs();
              const list = listSongNames();
              setSavedNames(list);
              setSelectedSaved("");
              setAllSongs([]);
              setCategories([]);
              showToast("Repertorio borrado.");
            }}
            onUploadChange={handleUploadRepertorio}
          />
        ) : mode === "tocar" ? (
          <PlayMode
            selectedSaved={selectedSaved}
            savedNamesCount={savedNames.length}
            onOpenPicker={() => setPickerOpen(true)}
            sections={playSections}
            selectedId={selectedPlayId}
            onSelectEvent={handleSelectEvent}
            onRemoveEvent={removeEvent}
            onReorderEvent={reorderEvent}
            noteLabelMode={noteLabelMode}
          />
        ) : (
          <ComposeMode
            notes={NOTES}
            noteLabelMode={noteLabelMode}
            doc={doc}
            onDocChange={setDoc}
            testMode={testMode}
            freeMode={freeMode}
            transpose={transpose}
            onTestModeChange={setTestMode}
            onFreeModeChange={setFreeMode}
            onTransposeDec={decTranspose}
            onTransposeInc={incTranspose}
            isEnabledNote={freeMode ? (() => true) : ((noteId) => hasFingeringForNote(shiftNote(noteId, -transpose) as NoteId))}
            onPreviewNote={(n) => play(n, 0.6)}
            selectedSaved={selectedSaved}
            savedNamesCount={savedNames.length}
            songLength={flatSong.events.length}
            onNewSong={() => {
              void (async () => {
                const ok = await confirmLoseChanges("Nueva canción");
                if (!ok) return;
                const fresh = createEmptySongDoc();
                setDoc(fresh);
                setSelectedPlayId(null);
                setSelectedSaved("");
                setTranspose(0);
                setBaselineFp(docFingerprint(fresh, 0));
              })();
            }}
            onOpenSave={() => setSaveOpen(true)}
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
        )}
        <SongPickerSidebar
          open={pickerOpen}
          songs={allSongs}
          onClose={() => setPickerOpen(false)}
          onPick={async (name) => {
            if (mode === "componer" && name !== selectedSaved) {
              const ok = await confirmLoseChanges(`Seleccionar "${name}"`);
              if (!ok) return false;
            }
            const loaded = loadSongDoc(name);
            if (loaded) {
              setDoc(loaded);
              setSelectedPlayId(null);
              const t = getSongTranspose(name);
              setTranspose(t);
              setSelectedSaved(name);
              setBaselineFp(docFingerprint(loaded, t));
            }
            return true;
          }}
        />
        <SaveSongModal
          open={saveOpen}
          initialName={selectedSaved || ""}
          categories={categories}
          initialCategory={(allSongs.find((s) => s.name === selectedSaved)?.category || "")}
          initialSubcategory={(allSongs.find((s) => s.name === selectedSaved)?.subcategory || "")}
          onCancel={() => setSaveOpen(false)}
          onSave={async (name, category, subcategory) => {
            if (flatSong.events.length === 0) {
              return;
            }
            if (hasSong(name)) {
              const ok = await askConfirm(`La canción "${name}" ya existe. ¿Sobrescribir?`);
              if (!ok) return;
            }
            saveSongDoc(name, doc, transpose, category, subcategory);
            setBaselineFp(docFingerprint(doc, transpose));
            const names = listSongNames();
            setSavedNames(names);
            setSelectedSaved(name);
            setAllSongs(listSongsWithCategories());
            setCategories(listCategories());
            setSaveOpen(false);
            showToast("Canción guardada");
          }}
        />
        <RenameSongModal
          open={renameOpen}
          initialName={selectedSaved || ""}
          onCancel={() => setRenameOpen(false)}
          onSave={async (newName) => {
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
            renameSong(selectedSaved, trimmed);
            const names = listSongNames();
            setSavedNames(names);
            setSelectedSaved(trimmed);
            setAllSongs(listSongsWithCategories());
            setRenameOpen(false);
            showToast("Nombre actualizado");
          }}
        />
      </div>
      <ErrorModal open={!!errorMsg} message={errorMsg || ""} onClose={() => setErrorMsg(null)} />
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
      <LoadingModal open={importLoading} title="Importando repertorio…" />
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
  );
}
