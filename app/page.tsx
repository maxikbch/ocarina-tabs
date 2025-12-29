"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import PianoKeyboard from "@/components/PianoKeyboard";
import SongTimeline from "@/components/SongTimeline";
import type { Fingering, HoleId, NoteEvent, NoteId } from "@/lib/types";
import { getFingeringForNote, EMPTY, hasFingeringForNote } from "@/lib/fingerings";
import { exportSongPdf } from "@/lib/exportPdf";
import { buildChromaticRange, shiftNote } from "@/lib/notes";
import type { NoteLabelMode } from "@/lib/noteLabels";
import { listSongNames, saveSong, loadSong, removeSong, hasSong, downloadBundle, getSongTranspose, clearAllSongs, listSongsWithCategories, listCategories, renameSong } from "@/lib/songStore";
import SongPickerSidebar from "@/components/SongPickerSidebar";
import SaveSongModal from "@/components/SaveSongModal";
import RenameSongModal from "@/components/RenameSongModal";
import { usePiano } from "@/lib/usePiano";
import ErrorModal from "@/components/ErrorModal";
import ConfirmModal from "@/components/ConfirmModal";
import PromptModal from "@/components/PromptModal";
import LoadingModal from "@/components/LoadingModal";

function cloneFingering(f: Fingering): Fingering {
  return { ...f };
}

export default function Page() {
  // Podés cambiar esto por el rango real de tu ocarina
  const NOTES = useMemo(() => buildChromaticRange({ from: "C4", to: "C6" }), []);

  const [song, setSong] = useState<NoteEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteLabelMode, setNoteLabelMode] = useState<NoteLabelMode>("latin");
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allSongs, setAllSongs] = useState<Array<{ name: string; category: string }>>([]);
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

  const selected = song.find((x) => x.id === selectedId);

  useEffect(() => {
    setSavedNames(listSongNames());
    setAllSongs(listSongsWithCategories());
    setCategories(listCategories());
  }, []);

  const { ready: pianoReady, play } = usePiano();
  const [transpose, setTranspose] = useState<number>(0);
  const [testMode, setTestMode] = useState<boolean>(false);
  const [freeMode, setFreeMode] = useState<boolean>(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const displaySong = useMemo<NoteEvent[]>(() => {
    if (!transpose) return song;
    return song.map((ev) => {
      if (ev.note === "—" || ev.note === "SPACE" || ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO") {
        return ev;
      }
      const shownNote = shiftNote(ev.note, -transpose);
      const f = getFingeringForNote(shownNote as NoteId, EMPTY);
      const snapshot: Fingering = typeof structuredClone === "function" ? structuredClone(f) : { ...f };
      return { ...ev, note: shownNote, fingering: snapshot };
    });
  }, [song, transpose]);

  function incTranspose() {
    setTranspose((t) => t + 1);
  }
  function decTranspose() {
    setTranspose((t) => t - 1);
  }

  // En freeMode mantenemos el mismo rango visual (3 áreas). Solo cambia la habilitación.

  async function handleNoteClick(note: string) {
    // Reproducir preview
    await play(note, 0.6);
    // Si hay una selección, desseleccionarla
    if (selectedId) {
      setSelectedId(null);
    }
    // Test Mode: no guardar notas
    if (testMode) {
      return;
    }
    // Guardar base = nota + transposición (evita el doble efecto en la vista)
    const storedNote = shiftNote(note, 0);
    const baseF = getFingeringForNote(storedNote as NoteId, EMPTY);
    const snapshot: Fingering = typeof structuredClone === "function" ? structuredClone(baseF) : { ...baseF };
    const ev: NoteEvent = { id: nanoid(), note: storedNote, fingering: snapshot };
    setSong((s) => [...s, ev]);
  }

  function notesString(arr: NoteEvent[]): string {
    return arr.map((e) => e.note).join(" ");
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
      if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 4 && parsed.songs) {
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
      let imported = 0;
      for (const [name, payload] of Object.entries(songsAny)) {
        let incomingNotes: string[] | null = null;
        let incomingTranspose: number = 0;
        if (payload && Array.isArray(payload)) {
          // legacy events array
          incomingNotes = (payload as any[]).map((e) => (e && typeof e === "object" ? (e as any).note : null)).filter(Boolean) as string[];
        } else if (payload && typeof payload === "object") {
          if (Array.isArray((payload as any).notes)) {
            incomingNotes = (payload as any).notes as string[];
          }
          if (typeof (payload as any).transpose === "number") {
            incomingTranspose = (payload as any).transpose as number;
          }
        }
        if (!incomingNotes) continue;

        const existing = loadSong(name);
        const a = existing ? notesString(existing) : "";
        const b = incomingNotes.join(" ");

        if (!existing) {
          // crear desde notas -> eventos y guardar
          const events: NoteEvent[] = incomingNotes.map((n) => {
            const base = getFingeringForNote(n as NoteId, EMPTY);
            const snapshot: Fingering = typeof structuredClone === "function" ? structuredClone(base) : { ...base };
            return { id: nanoid(), note: n, fingering: snapshot };
          });
          saveSong(name, events, incomingTranspose);
          imported++;
          continue;
        }

        if (a === b) {
          // idénticas: omitir
          continue;
        }
        const ok = await askConfirm(`La canción "${name}" ya existe.\n\nActual:\n${a}\n\nNueva:\n${b}\n\n¿Sobrescribir?`);
        if (ok) {
          const events: NoteEvent[] = incomingNotes.map((n) => {
            const base = getFingeringForNote(n as NoteId, EMPTY);
            const snapshot: Fingering = typeof structuredClone === "function" ? structuredClone(base) : { ...base };
            return { id: nanoid(), note: n, fingering: snapshot };
          });
          saveSong(name, events, incomingTranspose);
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
    setSong((s) => s.filter((x) => x.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function addSpace() {
    // Si hay selección y es especial, decidir según el tipo
    if (selectedId) {
      const idx = song.findIndex((x) => x.id === selectedId);
      if (idx >= 0) {
        const cur = song[idx];
        const isSpace = cur.note === "—" || cur.note === "SPACE";
        const isBreak = cur.note === "⏎" || cur.note === "BR" || cur.note === "SALTO";
        if (isSpace) {
          // mismo componente: no agregar nada
          return;
        }
        if (isBreak) {
          // reemplazar por espacio
          const ev: NoteEvent = { id: nanoid(), note: "—", fingering: EMPTY };
          setSong((s) => {
            const copy = [...s];
            copy[idx] = ev;
            return copy;
          });
          setSelectedId(ev.id);
          return;
        }
        // selección es una nota normal: insertar después
        const ev: NoteEvent = { id: nanoid(), note: "—", fingering: EMPTY };
        setSong((s) => {
          const copy = [...s];
          copy.splice(idx + 1, 0, ev);
          return copy;
        });
        setSelectedId(ev.id);
        return;
      }
    }
    // Comportamiento normal: agregar al final
    const ev: NoteEvent = { id: nanoid(), note: "—", fingering: EMPTY };
    setSong((s) => [...s, ev]);
    setSelectedId(ev.id);
  }

  function addLineBreak() {
    // Si hay selección y es especial, decidir según el tipo
    if (selectedId) {
      const idx = song.findIndex((x) => x.id === selectedId);
      if (idx >= 0) {
        const cur = song[idx];
        const isSpace = cur.note === "—" || cur.note === "SPACE";
        const isBreak = cur.note === "⏎" || cur.note === "BR" || cur.note === "SALTO";
        if (isBreak) {
          // mismo componente: no agregar nada
          return;
        }
        if (isSpace) {
          // reemplazar por salto
          const ev: NoteEvent = { id: nanoid(), note: "⏎", fingering: EMPTY };
          setSong((s) => {
            const copy = [...s];
            copy[idx] = ev;
            return copy;
          });
          setSelectedId(ev.id);
          return;
        }
        // selección es una nota normal: insertar después
        const ev: NoteEvent = { id: nanoid(), note: "⏎", fingering: EMPTY };
        setSong((s) => {
          const copy = [...s];
          copy.splice(idx + 1, 0, ev);
          return copy;
        });
        setSelectedId(ev.id);
        return;
      }
    }
    // Comportamiento normal: agregar al final
    const ev: NoteEvent = { id: nanoid(), note: "⏎", fingering: EMPTY };
    setSong((s) => [...s, ev]);
    setSelectedId(ev.id);
  }

  function moveEvent(id: string, dir: -1 | 1) {
    setSong((s) => {
      const i = s.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.length) return s;
      const copy = [...s];
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
      return copy;
    });
  }

  function reorderEvent(sourceId: string, targetIndex: number) {
    setSong((s) => {
      const from = s.findIndex((x) => x.id === sourceId);
      if (from < 0) return s;
      const clampedTarget = Math.max(0, Math.min(targetIndex, s.length - 1));
      const arr = [...s];
      const [item] = arr.splice(from, 1);
      const insertIndex = from < clampedTarget ? clampedTarget : clampedTarget;
      arr.splice(insertIndex, 0, item);
      return arr;
    });
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
    if (!id || id === selectedId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    const ev = displaySong.find((x) => x.id === id);
    if (!ev) return;
    if (ev.note === "—" || ev.note === "SPACE" || ev.note === "⏎" || ev.note === "BR" || ev.note === "SALTO") {
      return;
    }
    // reproducir la nota tal como se ve (ya transpuesta en displaySong)
    play(ev.note, 0.6);
  }

  return (
    <main style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Ocarina Tabs</h1>
          </div>
          <div style={{ opacity: 0.7 }}>
            Agregá notas con el teclado y revisá la secuencia.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={noteLabelMode}
            onChange={(e) => setNoteLabelMode(e.target.value as NoteLabelMode)}
            style={{ padding: "6px 10px", borderRadius: 10, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
            aria-label="Modo de nombres de notas"
            title="Modo de nombres de notas"
          >
            <option value="latin">Notación latina</option>
            <option value="letter">Notación anglosajona</option>
          </select>
        </div>
      </header>

      {/* Controles de compendio (debajo del título, arriba del teclado) */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, marginBottom: 6 }}>
        <button
          onClick={handleDownloadRepertorio}
          style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
          title="Descargar repertorio como JSON"
        >
          Descargar repertorio
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
          title="Cargar repertorio desde JSON"
        >
          Cargar repertorio
        </button>
        <button
          onClick={async () => {
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
          style={{ padding: "10px 12px", borderRadius: 12, background: "#7a1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
          title="Borrar todas las canciones guardadas"
        >
          Borrar repertorio
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleUploadRepertorio}
        />
      </div>

      <section style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center" }}>
          Teclado
          
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, userSelect: "none", marginLeft: "20px" }}>
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              title="No guardar notas al tocar"
              aria-label="Test Mode: no guardar notas al tocar"
            />
            Test Mode
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, userSelect: "none", marginLeft: "12px" }}>
            <input
              type="checkbox"
              checked={freeMode}
              onChange={(e) => setFreeMode(e.target.checked)}
              title="Tocar y guardar todas las teclas sin límite de área"
              aria-label="Free Mode: tocar todas las teclas"
            />
            Free Mode
          </label>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={decTranspose} style={{ padding: "4px 10px", borderRadius: 10 }}>–</button>
            <span style={{ minWidth: 28, textAlign: "center" }}>{transpose}</span>
            <button onClick={incTranspose} style={{ padding: "4px 10px", borderRadius: 10 }}>+</button>
          </span>
        </h2>
        <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{ width: "min(100%, 900px)" }}>
              <PianoKeyboard
                notes={NOTES}
                labelMode={noteLabelMode}
                onNoteClick={handleNoteClick}
                isEnabledNote={freeMode ? (() => true) : ((noteId) => hasFingeringForNote(shiftNote(noteId, -transpose) as NoteId))}
              />
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: "auto", marginBottom: "auto", marginLeft: 12 }}>
            <button
              onClick={addSpace}
              style={{ padding: "10px 10px", borderRadius: 12, width: "80px", height: "80px", whiteSpace: "nowrap", background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              title="Insertar un espacio en la canción"
            >
              Espacio
            </button>
            <button
              onClick={addLineBreak}
              style={{ padding: "10px 10px", borderRadius: 12, width: "80px", height: "80px", whiteSpace: "nowrap", background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              title="Insertar un salto de línea"
            >
              Salto
            </button>
          </div>
        </div>

        <div style={{ opacity: 0.65, fontSize: 13, lineHeight: 1.4 }}>
          Las digitaciones se leen desde `lib/fingerings.json`.
        </div>

        <div style={{ height: 4 }} />

        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
          Canción
          {selectedSaved ? (
            <>
              <span style={{ fontWeight: 400, opacity: 0.8 }}> — "{selectedSaved}"</span>
              <button
                onClick={() => setRenameOpen(true)}
                title="Renombrar canción"
                aria-label="Renombrar canción"
                style={{
                  marginLeft: 8,
                  padding: "2px 6px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#eaeaea",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                ✎
              </button>
            </>
          ) : null}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => {
                setSong([]);
                setSelectedId(null);
                setSelectedSaved("");
                setTranspose(0);
              }}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              title="Crear una canción nueva (vacía)"
            >
              Nueva canción
            </button>

            <button
              onClick={() => {
                setSaveOpen(true);
              }}
              disabled={song.length === 0}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", opacity: song.length === 0 ? 0.5 : 1, cursor: song.length === 0 ? "not-allowed" : "pointer" }}
              title="Guardar canción en memoria"
            >
              Guardar canción
            </button>

            <button
              onClick={() => setPickerOpen(true)}
              disabled={savedNames.length === 0}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              title={savedNames.length === 0 ? "No hay canciones guardadas" : "Abrir selector de canciones"}
            >
              Seleccionar canción
            </button>

            <button
              onClick={async () => {
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
              disabled={!selectedSaved}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", opacity: !selectedSaved ? 0.5 : 1, cursor: !selectedSaved ? "not-allowed" : "pointer" }}
              title="Eliminar canción guardada"
            >
              Borrar canción
            </button>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={async () => {
                const base = selectedSaved || "Canción Ocarina";
                const sign = transpose < 0 ? "−" : "+";
                const suffix = transpose !== 0 ? ` (T${sign}${Math.abs(transpose)})` : "";
                setExportLoading(true);
                try {
                  await exportSongPdf(displaySong, { labelMode: noteLabelMode, title: base + suffix, transpose });
                } finally {
                  setExportLoading(false);
                }
              }}
              disabled={song.length === 0}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", opacity: song.length === 0 ? 0.5 : 1, cursor: song.length === 0 ? "not-allowed" : "pointer" }}
            >
              Exportar PDF
            </button>
          </div>
        </div>
        <SongTimeline
          song={displaySong}
          selectedId={selectedId}
          onSelect={handleSelectEvent}
          onRemove={removeEvent}
          labelMode={noteLabelMode}
          onReorder={reorderEvent}
        />
      </section>
      <SongPickerSidebar
        open={pickerOpen}
        songs={allSongs}
        onClose={() => setPickerOpen(false)}
        onPick={(name) => {
          const loaded = loadSong(name);
          if (loaded) {
            setSong(loaded);
            setSelectedId(null);
            const t = getSongTranspose(name);
            setTranspose(t);
            setSelectedSaved(name);
          }
          setPickerOpen(false);
        }}
      />
      <SaveSongModal
        open={saveOpen}
        initialName={selectedSaved || ""}
        categories={categories}
        onCancel={() => setSaveOpen(false)}
        onSave={async (name, category) => {
          if (song.length === 0) {
            return;
          }
          if (hasSong(name)) {
            const ok = await askConfirm(`La canción "${name}" ya existe. ¿Sobrescribir?`);
            if (!ok) return;
          }
          saveSong(name, song, transpose, category);
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
