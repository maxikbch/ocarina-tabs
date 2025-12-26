"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import PianoKeyboard from "@/components/PianoKeyboard";
import SongTimeline from "@/components/SongTimeline";
import type { Fingering, HoleId, NoteEvent, NoteId } from "@/lib/types";
import { getFingeringForNote, EMPTY, hasFingeringForNote } from "@/lib/fingerings";
import { exportSongPdf } from "@/lib/exportPdf";
import { buildChromaticRange } from "@/lib/notes";
import type { NoteLabelMode } from "@/lib/noteLabels";
import { listSongNames, saveSong, loadSong, removeSong, hasSong, downloadBundle } from "@/lib/songStore";
import { usePiano } from "@/lib/usePiano";

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

  const selected = song.find((x) => x.id === selectedId);

  useEffect(() => {
    setSavedNames(listSongNames());
  }, []);

  const { ready: pianoReady, play } = usePiano();
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleNoteClick(note: string) {
    // Reproducir preview
    await play(note, 0.6);
    // Agregar a la canción
    const base = getFingeringForNote(note as NoteId, EMPTY);
    const snapshot: Fingering =
      typeof structuredClone === "function" ? structuredClone(base) : { ...base };
    const ev: NoteEvent = { id: nanoid(), note, fingering: snapshot };
    setSong((s) => [...s, ev]);
    setSelectedId(ev.id);
  }

  function notesString(arr: NoteEvent[]): string {
    return arr.map((e) => e.note).join(" ");
  }

  function handleDownloadRepertorio() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const example = `repertorio_ocarina_${yyyy}-${mm}-${dd}_${hh}_${min}.json`;
    const input = prompt("Nombre de archivo para descargar el repertorio:", example);
    const chosen = sanitizeFilename((input ?? "").trim()) || example;
    const finalName = chosen.toLowerCase().endsWith(".json") ? chosen : `${chosen}.json`;
    downloadBundle(finalName);
  }

  async function handleUploadRepertorio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as any;
      let songsAny: any = null;
      if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 2 && parsed.songs) {
        songsAny = parsed.songs; // { name: { notes: [...] } }
      } else if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 1 && parsed.songs) {
        songsAny = parsed.songs; // legacy { name: NoteEvent[] }
      } else if (parsed && typeof parsed === "object") {
        songsAny = parsed; // could be plain map
      }
      if (!songsAny || typeof songsAny !== "object") {
        alert("Archivo inválido.");
        return;
      }
      let imported = 0;
      for (const [name, payload] of Object.entries(songsAny)) {
        let incomingNotes: string[] | null = null;
        if (payload && Array.isArray(payload)) {
          // legacy events array
          incomingNotes = (payload as any[]).map((e) => (e && typeof e === "object" ? (e as any).note : null)).filter(Boolean) as string[];
        } else if (payload && typeof payload === "object" && Array.isArray((payload as any).notes)) {
          incomingNotes = (payload as any).notes as string[];
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
          saveSong(name, events);
          imported++;
          continue;
        }

        if (a === b) {
          // idénticas: omitir
          continue;
        }
        const ok = confirm(`La canción "${name}" ya existe.\n\nActual:\n${a}\n\nNueva:\n${b}\n\n¿Sobrescribir?`);
        if (ok) {
          const events: NoteEvent[] = incomingNotes.map((n) => {
            const base = getFingeringForNote(n as NoteId, EMPTY);
            const snapshot: Fingering = typeof structuredClone === "function" ? structuredClone(base) : { ...base };
            return { id: nanoid(), note: n, fingering: snapshot };
          });
          saveSong(name, events);
          imported++;
        }
      }
      setSavedNames(listSongNames());
      setSelectedSaved("");
      alert(`Importadas ${imported} canciones`);
    } catch (err) {
      alert("No se pudo leer el archivo de repertorio.");
    } finally {
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
    const ev: NoteEvent = { id: nanoid(), note: "—", fingering: EMPTY };
    setSong((s) => [...s, ev]);
    setSelectedId(ev.id);
  }

  function addLineBreak() {
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
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleUploadRepertorio}
        />
      </div>

      <section style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Teclado</h2>
        <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{ width: "min(100%, 900px)" }}>
              <PianoKeyboard
                notes={NOTES}
                labelMode={noteLabelMode}
                onNoteClick={handleNoteClick}
                isEnabledNote={(noteId) => hasFingeringForNote(noteId as NoteId)}
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

        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Canción</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => {
                setSong([]);
                setSelectedId(null);
                setSelectedSaved("");
              }}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              title="Crear una canción nueva (vacía)"
            >
              Nueva canción
            </button>

            <button
              onClick={() => {
                const name = prompt("Nombre de la canción:");
                if (!name) return;
                if (hasSong(name) && !confirm(`La canción "${name}" ya existe. ¿Sobrescribir?`)) {
                  return;
                }
                saveSong(name, song);
                setSavedNames(listSongNames());
                setSelectedSaved(name);
                alert("Canción guardada");
              }}
              disabled={song.length === 0}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              title="Guardar canción en memoria"
            >
              Guardar canción
            </button>

            <select
              value={selectedSaved}
              onChange={(e) => {
                const name = e.target.value;
                setSelectedSaved(name);
                const loaded = loadSong(name);
                if (loaded) {
                  setSong(loaded);
                  setSelectedId(null);
                }
              }}
              disabled={savedNames.length === 0}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)", minWidth: 180 }}
              title={savedNames.length === 0 ? "No hay canciones guardadas" : "Cargar canción guardada"}
            >
              {savedNames.length === 0 ? (
                <option value="">Sin canciones</option>
              ) : (
                <>
                  <option value="">Seleccionar canción…</option>
                  {savedNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </>
              )}
            </select>

            <button
              onClick={() => {
                if (!selectedSaved) return;
                if (!confirm(`¿Eliminar "${selectedSaved}" de la memoria?`)) return;
                removeSong(selectedSaved);
                const list = listSongNames();
                setSavedNames(list);
                setSelectedSaved("");
              }}
              disabled={!selectedSaved}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
              title="Eliminar canción guardada"
            >
              Borrar canción
            </button>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => exportSongPdf(song, { labelMode: noteLabelMode, title: selectedSaved || "Canción Ocarina" })}
              disabled={song.length === 0}
              style={{ padding: "10px 12px", borderRadius: 12, background: "#1f1f1f", color: "#eaeaea", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              Exportar PDF
            </button>
          </div>
        </div>
        <SongTimeline
          song={song}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={removeEvent}
          labelMode={noteLabelMode}
          onReorder={reorderEvent}
        />
      </section>
    </main>
  );
}
