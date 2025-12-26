import type { NoteEvent, NoteId } from "./types";
import { nanoid } from "nanoid";
import { getFingeringForNote, EMPTY } from "./fingerings";
// import { shiftNote } from "./notes";

const LS_KEY = "ocarina.songs.v3";

type NotesStoreEntry = { notes: string[]; transpose: number };
type NotesStore = Record<string, NotesStoreEntry>;

function readNotesStore(): NotesStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as any;
      if (parsed && parsed.version === 3 && parsed.songs && typeof parsed.songs === "object") {
        const out: NotesStore = {};
        for (const [k, v] of Object.entries(parsed.songs as Record<string, any>)) {
          const entry = v as any;
          out[k] = {
            notes: Array.isArray(entry.notes) ? entry.notes : [],
            transpose: typeof entry.transpose === "number" ? entry.transpose : 0,
          };
        }
        return out;
      }
    }
    // migrate from v2 or legacy
    const rawV2 = localStorage.getItem("ocarina.songs.v2");
    if (rawV2) {
      const p2 = JSON.parse(rawV2) as any;
      if (p2 && p2.version === 2 && p2.songs) {
        const out: NotesStore = {};
        for (const [k, v] of Object.entries(p2.songs as Record<string, any>)) {
          const arr = Array.isArray((v as any).notes) ? (v as any).notes as string[] : [];
          out[k] = { notes: arr, transpose: typeof (v as any).transpose === "number" ? (v as any).transpose : 0 };
        }
        writeNotesStore(out);
        return out;
      }
    }
    const rawV1 = localStorage.getItem("ocarina.songs.v1");
    if (rawV1) {
      const p1 = JSON.parse(rawV1) as any;
      let legacy: Record<string, any> | undefined;
      if (p1 && p1.version === 1 && p1.songs) legacy = p1.songs as Record<string, any>;
      else if (p1 && typeof p1 === "object") legacy = p1 as Record<string, any>;
      if (legacy) {
        const out: NotesStore = {};
        for (const [k, v] of Object.entries(legacy)) {
          if (Array.isArray(v)) {
            const notes = (v as any[]).map((e) => (e && typeof e === "object" ? (e as any).note : null)).filter(Boolean) as string[];
            out[k] = { notes, transpose: 0 };
          }
        }
        writeNotesStore(out);
        return out;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function writeNotesStore(store: NotesStore) {
  if (typeof window === "undefined") return;
  try {
    const bundle = { version: 3, songs: store };
    localStorage.setItem(LS_KEY, JSON.stringify(bundle));
  } catch {}
}

export function listSongNames(): string[] {
  return Object.keys(readNotesStore()).sort((a, b) => a.localeCompare(b));
}

// Save base notes + transpose
export function saveSong(name: string, song: NoteEvent[], transpose: number = 0) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  // Guardamos las notas tal como están en la canción (no las modificamos aquí)
  const baseNotes = song.map((e) => e.note);
  const store = readNotesStore();
  store[trimmed] = { notes: baseNotes, transpose };
  writeNotesStore(store);
}

// Load transposed events (real notes rendered/played), but titles can show base (subtract transpose in UI).
export function loadSong(name: string): NoteEvent[] | null {
  const store = readNotesStore();
  const entry = store[name];
  if (!entry) return null;
  const { notes } = entry;
  return notes.map((n) => {
    const f = getFingeringForNote(n as NoteId, EMPTY);
    const snapshot: any = typeof structuredClone === "function" ? structuredClone(f) : { ...f };
    return { id: nanoid(), note: n as string, fingering: snapshot };
  });
}

export function getSongTranspose(name: string): number {
  const store = readNotesStore();
  return store[name]?.transpose ?? 0;
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

export type SongNotesBundle = { version: 3; songs: Record<string, { notes: string[]; transpose: number }> };

export function exportBundle(): SongNotesBundle {
  const src = readNotesStore();
  const songs: Record<string, { notes: string[]; transpose: number }> = {};
  for (const [k, v] of Object.entries(src)) {
    songs[k] = { notes: v.notes || [], transpose: v.transpose ?? 0 };
  }
  return { version: 3, songs };
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

