import { nanoid } from "nanoid";
import { songDocFromStorage, songDocToStorage, type SongDoc } from "@/lib/songDoc";

const LS_KEY_V6 = "ocarina.songs.v6";
const LS_KEY_V5 = "ocarina.songs.v5";
const LS_KEY_V4 = "ocarina.songs.v4";

type SongV6Entry = {
  transpose: number;
  category?: string;
  subcategory?: string;
  sections: Record<string, { name: string; notes: string[] }>;
  arrangement: Array<{ sectionId: string }>;
};
type SongsStoreV6 = Record<string, SongV6Entry>;

type NotesStoreEntryV5 = { notes: string[]; transpose: number; category?: string };
type NotesStoreV5 = Record<string, NotesStoreEntryV5>;

function writeStoreV6(store: SongsStoreV6) {
  if (typeof window === "undefined") return;
  try {
    const bundle = { version: 6, songs: store };
    localStorage.setItem(LS_KEY_V6, JSON.stringify(bundle));
  } catch {}
}

function migrateV5ToV6(v5: NotesStoreV5): SongsStoreV6 {
  const out: SongsStoreV6 = {};
  for (const [name, entry] of Object.entries(v5 || {})) {
    const notes = Array.isArray(entry?.notes) ? entry.notes : [];
    const sectionId = nanoid();
    out[name] = {
      transpose: typeof entry?.transpose === "number" ? entry.transpose : 0,
      category: typeof entry?.category === "string" ? entry.category : "",
      subcategory: "",
      sections: { [sectionId]: { name: "General", notes } },
      arrangement: [{ sectionId }],
    };
  }
  return out;
}

function readStoreV5(): NotesStoreV5 {
  if (typeof window === "undefined") return {};
  try {
    const rawV5 = localStorage.getItem(LS_KEY_V5);
    if (rawV5) {
      const p5 = JSON.parse(rawV5) as any;
      if (p5 && p5.version === 5 && p5.songs && typeof p5.songs === "object") {
        const out: NotesStoreV5 = {};
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

    const rawV4 = localStorage.getItem(LS_KEY_V4);
    if (rawV4) {
      const p4 = JSON.parse(rawV4) as any;
      if (p4 && p4.version === 4 && p4.songs && typeof p4.songs === "object") {
        const out: NotesStoreV5 = {};
        for (const [k, v] of Object.entries(p4.songs as Record<string, any>)) {
          const entry = v as any;
          out[k] = {
            notes: Array.isArray(entry.notes) ? entry.notes : [],
            transpose: typeof entry.transpose === "number" ? entry.transpose : 0,
            category: typeof entry.category === "string" ? entry.category : "",
          };
        }
        // Persist as v5 for compatibility (legacy)
        try {
          localStorage.setItem(LS_KEY_V5, JSON.stringify({ version: 5, songs: out }));
        } catch {}
        return out;
      }
    }

    const rawV3 = localStorage.getItem("ocarina.songs.v3");
    if (rawV3) {
      const p3 = JSON.parse(rawV3) as any;
      if (p3 && p3.version === 3 && p3.songs && typeof p3.songs === "object") {
        const out: NotesStoreV5 = {};
        for (const [k, v] of Object.entries(p3.songs as Record<string, any>)) {
          const entry = v as any;
          out[k] = {
            notes: Array.isArray(entry.notes) ? entry.notes : [],
            transpose: typeof entry.transpose === "number" ? entry.transpose : 0,
            category: "",
          };
        }
        try {
          localStorage.setItem(LS_KEY_V5, JSON.stringify({ version: 5, songs: out }));
        } catch {}
        return out;
      }
    }

    const rawV2 = localStorage.getItem("ocarina.songs.v2");
    if (rawV2) {
      const p2 = JSON.parse(rawV2) as any;
      if (p2 && p2.version === 2 && p2.songs) {
        const out: NotesStoreV5 = {};
        for (const [k, v] of Object.entries(p2.songs as Record<string, any>)) {
          const arr = Array.isArray((v as any).notes) ? ((v as any).notes as string[]) : [];
          out[k] = { notes: arr, transpose: typeof (v as any).transpose === "number" ? (v as any).transpose : 0, category: "" };
        }
        try {
          localStorage.setItem(LS_KEY_V5, JSON.stringify({ version: 5, songs: out }));
        } catch {}
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
        const out: NotesStoreV5 = {};
        for (const [k, v] of Object.entries(legacy)) {
          if (Array.isArray(v)) {
            const notes = (v as any[]).map((e) => (e && typeof e === "object" ? (e as any).note : null)).filter(Boolean) as string[];
            out[k] = { notes, transpose: 0, category: "" };
          }
        }
        try {
          localStorage.setItem(LS_KEY_V5, JSON.stringify({ version: 5, songs: out }));
        } catch {}
        return out;
      }
    }

    return {};
  } catch {
    return {};
  }
}

function readStoreV6(): SongsStoreV6 {
  if (typeof window === "undefined") return {};
  try {
    const rawV6 = localStorage.getItem(LS_KEY_V6);
    if (rawV6) {
      const p6 = JSON.parse(rawV6) as any;
      if (p6 && p6.version === 6 && p6.songs && typeof p6.songs === "object") {
        const out: SongsStoreV6 = {};
        for (const [k, v] of Object.entries(p6.songs as Record<string, any>)) {
          const entry = v as any;
          out[k] = {
            transpose: typeof entry.transpose === "number" ? entry.transpose : 0,
            category: typeof entry.category === "string" ? entry.category : "",
            subcategory: typeof entry.subcategory === "string" ? entry.subcategory : "",
            sections: entry.sections && typeof entry.sections === "object" ? (entry.sections as any) : {},
            arrangement: Array.isArray(entry.arrangement) ? (entry.arrangement as any) : [],
          };
        }
        return out;
      }
    }

    // Migrate from v5 (or earlier)
    const v5 = readStoreV5();
    const migrated = migrateV5ToV6(v5);
    writeStoreV6(migrated);
    return migrated;
  } catch {
    return {};
  }
}

export function listSongNames(): string[] {
  return Object.keys(readStoreV6()).sort((a, b) => a.localeCompare(b));
}

export function saveSongDoc(name: string, doc: SongDoc, transpose: number = 0, category: string = "", subcategory: string = "") {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const store = readStoreV6();
  const { sections, arrangement } = songDocToStorage(doc);
  store[trimmed] = { transpose, category: (category || "").trim(), subcategory: (subcategory || "").trim(), sections, arrangement };
  writeStoreV6(store);
}

export function loadSongDoc(name: string): SongDoc | null {
  const store = readStoreV6();
  const entry = store[name];
  if (!entry) return null;
  const payload = { sections: entry.sections || {}, arrangement: entry.arrangement || [] };
  return songDocFromStorage(payload);
}

export function getSongTranspose(name: string): number {
  const store = readStoreV6();
  return store[name]?.transpose ?? 0;
}

export function removeSong(name: string) {
  const store = readStoreV6();
  if (store[name]) {
    delete store[name];
    writeStoreV6(store);
  }
}

export function hasSong(name: string): boolean {
  const store = readStoreV6();
  return !!store[name];
}

export type SongNotesBundle = { version: 6; songs: Record<string, SongV6Entry> };

export function exportBundle(): SongNotesBundle {
  const src = readStoreV6();
  const songs: Record<string, SongV6Entry> = {};
  for (const [k, v] of Object.entries(src)) {
    songs[k] = {
      transpose: v.transpose ?? 0,
      category: v.category || "",
      subcategory: v.subcategory || "",
      sections: v.sections || {},
      arrangement: v.arrangement || [],
    };
  }
  return { version: 6, songs };
}

export function exportBundleForNames(names: string[]): SongNotesBundle {
  const src = readStoreV6();
  const pick = new Set((names || []).map((n) => (n || "").trim()).filter(Boolean));
  const songs: Record<string, SongV6Entry> = {};
  for (const name of pick) {
    const v = src[name];
    if (!v) continue;
    songs[name] = {
      transpose: v.transpose ?? 0,
      category: v.category || "",
      subcategory: v.subcategory || "",
      sections: v.sections || {},
      arrangement: v.arrangement || [],
    };
  }
  return { version: 6, songs };
}

export function downloadBundle(filename = "compendio.json") {
  const data = JSON.stringify(exportBundle(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadBundleForNames(names: string[], filename = "compendio.json") {
  const data = JSON.stringify(exportBundleForNames(names), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
  const CS: any = (globalThis as any).CompressionStream;
  if (!CS) return null;
  try {
    const cs = new CS("gzip");
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(cs);
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

export async function makeSongShareCode(name: string): Promise<string | null> {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const bundle = exportBundleForNames([trimmed]);
  if (!bundle.songs[trimmed]) return null;
  const json = JSON.stringify(bundle);
  const raw = new TextEncoder().encode(json);
  const gz = await gzipBytes(raw);
  if (gz) return `OC6GZ:${base64UrlFromBytes(gz)}`;
  return `OC6:${base64UrlFromBytes(raw)}`;
}

export function clearAllSongs() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY_V6);
    localStorage.removeItem(LS_KEY_V5);
    localStorage.removeItem(LS_KEY_V4);
    localStorage.removeItem("ocarina.songs.v3");
    localStorage.removeItem("ocarina.songs.v2");
    localStorage.removeItem("ocarina.songs.v1");
  } catch {}
}

export function listSongsWithCategories(): Array<{ name: string; category: string; subcategory: string }> {
  const store = readStoreV6();
  return Object.keys(store)
    .map((n) => ({ name: n, category: store[n]?.category || "", subcategory: store[n]?.subcategory || "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listCategories(): string[] {
  const store = readStoreV6();
  const set = new Set<string>();
  for (const v of Object.values(store)) {
    const c = (v?.category || "").trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function setSongCategory(name: string, category: string) {
  const store = readStoreV6();
  if (!store[name]) return;
  store[name].category = (category || "").trim();
  writeStoreV6(store);
}

export function setSongSubcategory(name: string, subcategory: string) {
  const store = readStoreV6();
  if (!store[name]) return;
  store[name].subcategory = (subcategory || "").trim();
  writeStoreV6(store);
}

export function renameCategory(oldName: string, newName: string) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (typeof window === "undefined") return;
  const store = readStoreV6();

  // Renombrar categoría para todas las canciones que la usen.
  // Permite `to === ""` para "Sin categoría".
  let changed = false;
  for (const v of Object.values(store)) {
    const cur = (v?.category || "").trim();
    if (cur === from) {
      v.category = to;
      changed = true;
    }
  }
  if (changed) writeStoreV6(store);
}

export function renameSubcategory(oldName: string, newName: string) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (typeof window === "undefined") return;
  const store = readStoreV6();

  // Renombrar subcategoría para todas las canciones que la usen.
  // Permite `to === ""` para "Sin subcategoría".
  let changed = false;
  for (const v of Object.values(store)) {
    const cur = (v?.subcategory || "").trim();
    if (cur === from) {
      v.subcategory = to;
      changed = true;
    }
  }
  if (changed) writeStoreV6(store);
}

export function renameSong(oldName: string, newName: string) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (!from || !to) return;
  const store = readStoreV6();
  if (!store[from]) return;
  const payload = store[from];
  store[to] = payload;
  if (from !== to) {
    delete store[from];
  }
  writeStoreV6(store);
}

