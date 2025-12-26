import type { NoteEvent, NoteId } from "./types";
import { nanoid } from "nanoid";
import { getFingeringForNote, EMPTY } from "./fingerings";

const LS_KEY = "ocarina.songs.v2";

type NotesStore = Record<string, string[]>;

function readNotesStore(): NotesStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as any;
    // v2 format { version:2, songs: { name: { notes: [...] } } }
    if (parsed && parsed.version === 2 && parsed.songs && typeof parsed.songs === "object") {
      const out: NotesStore = {};
      for (const [k, v] of Object.entries(parsed.songs as Record<string, any>)) {
        const arr = Array.isArray((v as any).notes) ? (v as any).notes as string[] : [];
        out[k] = arr;
      }
      return out;
    }
    // legacy plain store: { name: NoteEvent[] } or { version:1, songs:{...} }
    let legacy: Record<string, any> | undefined;
    if (parsed && parsed.version === 1 && parsed.songs) {
      legacy = parsed.songs as Record<string, any>;
    } else if (parsed && typeof parsed === "object") {
      legacy = parsed as Record<string, any>;
    }
    if (legacy) {
      const out: NotesStore = {};
      for (const [k, v] of Object.entries(legacy)) {
        if (Array.isArray(v)) {
          const notes = (v as any[]).map((e) => (e && typeof e === "object" ? (e as any).note : null)).filter(Boolean) as string[];
          out[k] = notes;
        }
      }
      // migrate to v2 on read
      writeNotesStore(out);
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

function writeNotesStore(store: NotesStore) {
  if (typeof window === "undefined") return;
  try {
    const bundle: SongNotesBundle = { version: 2, songs: Object.fromEntries(Object.entries(store).map(([k, notes]) => [k, { notes }])) };
    localStorage.setItem(LS_KEY, JSON.stringify(bundle));
  } catch {}
}

export function listSongNames(): string[] {
  const store = readNotesStore();
  return Object.keys(store).sort((a, b) => a.localeCompare(b));
}

export function saveSong(name: string, song: NoteEvent[]) {
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const store = readNotesStore();
  store[trimmed] = song.map((e) => e.note);
  writeNotesStore(store);
}

export function loadSong(name: string): NoteEvent[] | null {
  const store = readNotesStore();
  const notes = store[name];
  if (!notes) return null;
  return notes.map((n) => ({
    id: nanoid(),
    note: n as string,
    fingering: getFingeringForNote(n as NoteId, EMPTY),
  }));
}

export function removeSong(name: string) {
  const store = readNotesStore();
  if (store[name]) {
    delete store[name];
    writeNotesStore(store);
  }
}

export function hasSong(name: string): boolean {
  const store = readNotesStore();
  return !!store[name];
}

// NUEVO formato de exportación simplificado:
// { version: 2, songs: { "<nombre>": { notes: string[] } } }
export type SongNotesBundle = { version: 2; songs: Record<string, { notes: string[] }> };

export function exportBundle(): SongNotesBundle {
  const src = readNotesStore();
  const out: Record<string, { notes: string[] }> = {};
  for (const [name, notes] of Object.entries(src)) out[name] = { notes };
  return { version: 2, songs: out };
}

export function downloadBundle(filename = "repertorio.json") {
  const data = JSON.stringify(exportBundle(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}


