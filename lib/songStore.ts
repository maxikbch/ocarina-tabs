import type { NoteEvent, NoteId } from "./types";
import { nanoid } from "nanoid";
import { getFingeringForNote, EMPTY } from "./fingerings";

const LS_KEY_V5 = "ocarina.songs.v5";
const LS_KEY_V4 = "ocarina.songs.v4";

type NotesStoreEntry = { notes: string[]; transpose: number; category?: string };
type NotesStore = Record<string, NotesStoreEntry>;

function readNotesStore(): NotesStore {
  if (typeof window === "undefined") return {};
  try {
    // Prefer v5
    const rawV5 = localStorage.getItem(LS_KEY_V5);
    if (rawV5) {
      const p5 = JSON.parse(rawV5) as any;
      if (p5 && p5.version === 5 && p5.songs && typeof p5.songs === "object") {
        const out: NotesStore = {};
        for (const [k, v] of Object.entries(p5.songs as Record<string, any>)) {
          const entry = v as any;
          out[k] = {
            notes: Array.isArray(entry.notes) ? entry.notes : [],
            transpose: typeof entry.transpose === "number" ? entry.transpose : 0,
            category: typeof entry.category === "string" ? entry.category : "",
          };
        }
        return out;
      }
    }

    // Fallback: migrate from v4
    const rawV4 = localStorage.getItem(LS_KEY_V4);
    if (rawV4) {
      const p4 = JSON.parse(rawV4) as any;
      if (p4 && p4.version === 4 && p4.songs && typeof p4.songs === "object") {
        const out: NotesStore = {};
        for (const [k, v] of Object.entries(p4.songs as Record<string, any>)) {
          const entry = v as any;
          out[k] = {
            notes: Array.isArray(entry.notes) ? entry.notes : [],
            transpose: typeof entry.transpose === "number" ? entry.transpose : 0,
            category: typeof entry.category === "string" ? entry.category : "",
          };
        }
        writeNotesStore(out); // persist as v5
        return out;
      }
    }

    // Fallback: migrate from v3
    const rawV3 = localStorage.getItem("ocarina.songs.v3");
    if (rawV3) {
      const p3 = JSON.parse(rawV3) as any;
      if (p3 && p3.version === 3 && p3.songs && typeof p3.songs === "object") {
        const out: NotesStore = {};
        for (const [k, v] of Object.entries(p3.songs as Record<string, any>)) {
          const entry = v as any;
          out[k] = {
            notes: Array.isArray(entry.notes) ? entry.notes : [],
            transpose: typeof entry.transpose === "number" ? entry.transpose : 0,
            category: "",
          };
        }
        writeNotesStore(out); // persist as v5
        return out;
      }
    }

    // migrate from v2
    const rawV2 = localStorage.getItem("ocarina.songs.v2");
    if (rawV2) {
      const p2 = JSON.parse(rawV2) as any;
      if (p2 && p2.version === 2 && p2.songs) {
        const out: NotesStore = {};
        for (const [k, v] of Object.entries(p2.songs as Record<string, any>)) {
          const arr = Array.isArray((v as any).notes) ? ((v as any).notes as string[]) : [];
          out[k] = { notes: arr, transpose: typeof (v as any).transpose === "number" ? (v as any).transpose : 0, category: "" };
        }
        writeNotesStore(out);
        return out;
      }
    }

    // migrate from v1 / legacy
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
            out[k] = { notes, transpose: 0, category: "" };
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
    const bundle = { version: 5, songs: store };
    localStorage.setItem(LS_KEY_V5, JSON.stringify(bundle));
  } catch {}
}

export function listSongNames(): string[] {
  return Object.keys(readNotesStore()).sort((a, b) => a.localeCompare(b));
}

// Save base notes (tal cual teclado) + transpose
export function saveSong(name: string, song: NoteEvent[], transpose: number = 0, category: string = "") {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const baseNotes = song.map((e) => e.note);
  const store = readNotesStore();
  store[trimmed] = { notes: baseNotes, transpose, category: (category || "").trim() };
  writeNotesStore(store);
}

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

export type SongNotesBundle = { version: 5; songs: Record<string, { notes: string[]; transpose: number; category?: string }> };

export function exportBundle(): SongNotesBundle {
  const src = readNotesStore();
  const songs: Record<string, { notes: string[]; transpose: number; category?: string }> = {};
  for (const [k, v] of Object.entries(src)) {
    songs[k] = { notes: v.notes || [], transpose: v.transpose ?? 0, category: v.category || "" };
  }
  return { version: 5, songs };
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

export function clearAllSongs() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY_V5);
    localStorage.removeItem(LS_KEY_V4);
    // limpiar versiones anteriores por si existen
    localStorage.removeItem("ocarina.songs.v3");
    localStorage.removeItem("ocarina.songs.v2");
    localStorage.removeItem("ocarina.songs.v1");
  } catch {}
}

export function listSongsWithCategories(): Array<{ name: string; category: string }> {
  const store = readNotesStore();
  return Object.keys(store)
    .map((n) => ({ name: n, category: store[n]?.category || "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listCategories(): string[] {
  const store = readNotesStore();
  const set = new Set<string>();
  for (const v of Object.values(store)) {
    const c = (v?.category || "").trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function setSongCategory(name: string, category: string) {
  const store = readNotesStore();
  if (!store[name]) return;
  store[name].category = (category || "").trim();
  writeNotesStore(store);
}

export function renameSong(oldName: string, newName: string) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (!from || !to) return;
  const store = readNotesStore();
  if (!store[from]) return;
  const payload = store[from];
  // mover/overwrites si ya existe
  store[to] = payload;
  if (from !== to) {
    delete store[from];
  }
  writeNotesStore(store);
}

