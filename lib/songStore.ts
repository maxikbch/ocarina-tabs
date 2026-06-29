import { nanoid } from "nanoid";
import { songDocFromStorage, songDocToStorage, type SongDoc } from "@/lib/songDoc";
import { migrateV1ToV2 } from "@/lib/songDocMigrate";
import { flattenDocV2ForPlay } from "@/lib/songDocV2Adapter";
import { createEmptySongDocV2, docFingerprintV2, type SongDocV2 } from "@/lib/songDocV2";

const LS_KEY_V7 = "ocarina.songs.v7";
const LS_KEY_V6 = "ocarina.songs.v6";
const LS_KEY_V5 = "ocarina.songs.v5";
const LS_KEY_V4 = "ocarina.songs.v4";
const LS_KEY_DRAFT = "ocarina.draft";
const LS_KEY_DRAFT_V2 = "ocarina.draft.v2";

type SongV6Entry = {
  transpose: number;
  category?: string;
  subcategory?: string;
  sections: Record<string, { name: string; notes: string[] }>;
  arrangement: Array<{ sectionId: string }>;
};
type SongsStoreV6 = Record<string, SongV6Entry>;

export type SongV7Entry = {
  transpose: number;
  category?: string;
  subcategory?: string;
  doc: SongDocV2;
};
type SongsStoreV7 = Record<string, SongV7Entry>;

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

function writeStoreV7(store: SongsStoreV7) {
  if (typeof window === "undefined") return;
  try {
    const bundle = { version: 7, songs: store };
    localStorage.setItem(LS_KEY_V7, JSON.stringify(bundle));
  } catch {}
}

function readStoreV7(): SongsStoreV7 {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY_V7);
    if (!raw) return {};
    const p = JSON.parse(raw) as any;
    if (!p || p.version !== 7 || !p.songs || typeof p.songs !== "object") return {};
    const out: SongsStoreV7 = {};
    for (const [k, v] of Object.entries(p.songs as Record<string, any>)) {
      const entry = v as any;
      if (!entry?.doc || entry.doc.version !== 2) continue;
      out[k] = {
        transpose: typeof entry.transpose === "number" ? entry.transpose : 0,
        category: typeof entry.category === "string" ? entry.category : "",
        subcategory: typeof entry.subcategory === "string" ? entry.subcategory : "",
        doc: entry.doc as SongDocV2,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function removeSongV6Only(name: string) {
  const store = readStoreV6();
  if (store[name]) {
    delete store[name];
    writeStoreV6(store);
  }
}

function removeSongV7Only(name: string) {
  const store = readStoreV7();
  if (store[name]) {
    delete store[name];
    writeStoreV7(store);
  }
}

export function listSongNames(): string[] {
  const v6 = readStoreV6();
  const v7 = readStoreV7();
  const names = new Set([...Object.keys(v6), ...Object.keys(v7)]);
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function hasSongV2(name: string): boolean {
  return !!readStoreV7()[name];
}

export function getSongDocFormat(name: string): "v1" | "v2" | null {
  if (hasSongV2(name)) return "v2";
  if (readStoreV6()[name]) return "v1";
  return null;
}

export function saveSongDocV2(
  name: string,
  doc: SongDocV2,
  transpose: number = 0,
  category: string = "",
  subcategory: string = ""
) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const store = readStoreV7();
  store[trimmed] = {
    transpose,
    category: (category || "").trim(),
    subcategory: (subcategory || "").trim(),
    doc,
  };
  writeStoreV7(store);
  removeSongV6Only(trimmed);
}

export function loadSongDocV2(name: string): SongDocV2 | null {
  const entry = readStoreV7()[name];
  if (!entry?.doc) return null;
  return entry.doc;
}

export function getSongTransposeV2(name: string): number {
  return readStoreV7()[name]?.transpose ?? 0;
}

export function getSongCategoryV2(name: string): { category: string; subcategory: string } {
  const entry = readStoreV7()[name];
  return {
    category: entry?.category || "",
    subcategory: entry?.subcategory || "",
  };
}

export type DraftRecoveryV2 = {
  doc: SongDocV2;
  transpose: number;
  savedName: string;
  savedAt: number;
};

export function saveDraftV2(doc: SongDocV2, transpose: number, savedName: string = "") {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      version: 2,
      doc,
      transpose: Number(transpose) || 0,
      savedName: typeof savedName === "string" ? savedName : "",
      savedAt: Date.now(),
    };
    localStorage.setItem(LS_KEY_DRAFT_V2, JSON.stringify(payload));
  } catch {}
}

export function loadDraftV2(): DraftRecoveryV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY_DRAFT_V2);
    if (!raw) return null;
    const p = JSON.parse(raw) as any;
    if (!p || p.version !== 2 || !p.doc || p.doc.version !== 2) return null;
    return {
      doc: p.doc as SongDocV2,
      transpose: typeof p.transpose === "number" ? p.transpose : 0,
      savedName: typeof p.savedName === "string" ? p.savedName : "",
      savedAt: typeof p.savedAt === "number" ? p.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearDraftV2() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY_DRAFT_V2);
  } catch {}
}

export function saveSongDoc(name: string, doc: SongDoc, transpose: number = 0, category: string = "", subcategory: string = "") {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const store = readStoreV6();
  const { sections, arrangement } = songDocToStorage(doc);
  store[trimmed] = { transpose, category: (category || "").trim(), subcategory: (subcategory || "").trim(), sections, arrangement };
  writeStoreV6(store);
  removeSongV7Only(trimmed);
}

export function loadSongDoc(name: string): SongDoc | null {
  const store = readStoreV6();
  const entry = store[name];
  if (!entry) return null;
  const payload = { sections: entry.sections || {}, arrangement: entry.arrangement || [] };
  return songDocFromStorage(payload);
}

export function getSongTranspose(name: string): number {
  const v7 = readStoreV7()[name];
  if (v7) return v7.transpose ?? 0;
  const store = readStoreV6();
  return store[name]?.transpose ?? 0;
}

export type DraftRecovery = {
  doc: SongDoc;
  transpose: number;
  savedName: string;
  savedAt: number;
};

export function saveDraft(doc: SongDoc, transpose: number, savedName: string = "") {
  if (typeof window === "undefined") return;
  try {
    const { sections, arrangement } = songDocToStorage(doc);
    const payload = {
      version: 1,
      sections,
      arrangement,
      transpose: Number(transpose) || 0,
      savedName: typeof savedName === "string" ? savedName : "",
      savedAt: Date.now(),
    };
    localStorage.setItem(LS_KEY_DRAFT, JSON.stringify(payload));
  } catch {}
}

export function loadDraft(): DraftRecovery | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY_DRAFT);
    if (!raw) return null;
    const p = JSON.parse(raw) as any;
    if (!p || p.version !== 1 || !p.sections || !p.arrangement) return null;
    const doc = songDocFromStorage({ sections: p.sections, arrangement: p.arrangement });
    return {
      doc,
      transpose: typeof p.transpose === "number" ? p.transpose : 0,
      savedName: typeof p.savedName === "string" ? p.savedName : "",
      savedAt: typeof p.savedAt === "number" ? p.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY_DRAFT);
  } catch {}
}

export function removeSong(name: string) {
  const storeV6 = readStoreV6();
  let changedV6 = false;
  if (storeV6[name]) {
    delete storeV6[name];
    writeStoreV6(storeV6);
    changedV6 = true;
  }
  const storeV7 = readStoreV7();
  if (storeV7[name]) {
    delete storeV7[name];
    writeStoreV7(storeV7);
  } else if (!changedV6) {
    // no-op
  }
}

export function hasSong(name: string): boolean {
  return !!readStoreV6()[name] || !!readStoreV7()[name];
}

export type CompendiumBundleEntryV7 = {
  transpose: number;
  category?: string;
  subcategory?: string;
  doc: SongDocV2;
};

export type CompendiumBundleV7 = {
  version: 7;
  songs: Record<string, CompendiumBundleEntryV7>;
};

/** @deprecated Usar CompendiumBundleV7 */
export type SongNotesBundle = CompendiumBundleV7;

function bundleEntryFromSong(name: string): CompendiumBundleEntryV7 | null {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  const entryV7 = readStoreV7()[trimmed];
  if (entryV7?.doc?.version === 2) {
    return {
      transpose: entryV7.transpose ?? 0,
      category: entryV7.category || "",
      subcategory: entryV7.subcategory || "",
      doc: entryV7.doc,
    };
  }

  const entryV6 = readStoreV6()[trimmed];
  if (!entryV6) return null;

  const doc = loadSongDoc(trimmed);
  if (!doc) return null;

  return {
    transpose: entryV6.transpose ?? 0,
    category: entryV6.category || "",
    subcategory: entryV6.subcategory || "",
    doc: migrateV1ToV2(doc),
  };
}

export function exportBundle(): CompendiumBundleV7 {
  const songs: Record<string, CompendiumBundleEntryV7> = {};
  for (const name of listSongNames()) {
    const entry = bundleEntryFromSong(name);
    if (entry) songs[name] = entry;
  }
  return { version: 7, songs };
}

export function exportBundleForNames(names: string[]): CompendiumBundleV7 {
  const pick = new Set((names || []).map((n) => (n || "").trim()).filter(Boolean));
  const songs: Record<string, CompendiumBundleEntryV7> = {};
  for (const name of pick) {
    const entry = bundleEntryFromSong(name);
    if (entry) songs[name] = entry;
  }
  return { version: 7, songs };
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

function docFromNotes(notes: string[]): SongDoc {
  const realSid = nanoid();
  return songDocFromStorage({
    sections: { [realSid]: { name: "General", notes: notes || [] } },
    arrangement: [{ sectionId: realSid }],
  });
}

function resolveSongsMap(parsed: unknown): { songs: Record<string, unknown>; fileVersion: number | null } {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Formato inválido.");
  }
  const obj = parsed as Record<string, unknown>;
  if ("version" in obj && "songs" in obj && obj.songs && typeof obj.songs === "object") {
    const version = typeof obj.version === "number" ? obj.version : null;
    return { songs: obj.songs as Record<string, unknown>, fileVersion: version };
  }
  return { songs: obj as Record<string, unknown>, fileVersion: null };
}

type ParsedIncomingSong = {
  doc: SongDocV2;
  transpose: number;
  category: string;
  subcategory: string;
  migrated: boolean;
};

function parseLegacyPayload(payload: unknown): SongDoc | null {
  if (payload && Array.isArray(payload)) {
    const incomingNotes = (payload as unknown[])
      .map((e) => (e && typeof e === "object" ? (e as { note?: string }).note : null))
      .filter(Boolean) as string[];
    return docFromNotes(incomingNotes);
  }
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (p.sections && p.arrangement) {
    return songDocFromStorage({
      sections: p.sections as Record<string, { name: string; notes: string[] }>,
      arrangement: p.arrangement as Array<{ sectionId: string }>,
    });
  }
  if (Array.isArray(p.notes)) {
    return docFromNotes(p.notes as string[]);
  }
  return null;
}

function parseIncomingSong(name: string, payload: unknown, fileVersion: number | null): ParsedIncomingSong | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  let transpose = 0;
  let category = "";
  let subcategory = "";
  if (typeof p.transpose === "number") transpose = p.transpose;
  if (typeof p.category === "string") category = p.category;
  if (typeof p.subcategory === "string") subcategory = p.subcategory;

  if (fileVersion === 7 && p.doc && typeof p.doc === "object" && (p.doc as SongDocV2).version === 2) {
    return {
      doc: p.doc as SongDocV2,
      transpose,
      category,
      subcategory,
      migrated: false,
    };
  }

  const legacyDoc = parseLegacyPayload(payload);
  if (!legacyDoc) return null;

  return {
    doc: migrateV1ToV2(legacyDoc),
    transpose,
    category,
    subcategory,
    migrated: true,
  };
}

function existingSongFingerprint(name: string): string | null {
  const transpose = getSongTranspose(name);
  const v7 = loadSongDocV2(name);
  if (v7) return docFingerprintV2(v7, transpose);
  const v6 = loadSongDoc(name);
  if (v6) return docFingerprintV2(migrateV1ToV2(v6), transpose);
  return null;
}

function summarizeDocV2(doc: SongDocV2): string {
  const { events } = flattenDocV2ForPlay(doc);
  return events.map((e) => e.note).join(" ");
}

export type ImportCompendiumOptions = {
  hasSong: (name: string) => boolean;
  askImportChoice: (message: string) => Promise<"overwrite" | "rename" | "skip">;
  askSaveAsName: (existingName: string) => Promise<string | null>;
};

export type ImportCompendiumResult = {
  imported: number;
  migrated: number;
  skipped: number;
};

export async function importCompendiumParsed(
  parsed: unknown,
  options: ImportCompendiumOptions
): Promise<ImportCompendiumResult> {
  const { songs: songsAny, fileVersion } = resolveSongsMap(parsed);
  if (!songsAny || typeof songsAny !== "object") {
    throw new Error("El compendio no contiene canciones.");
  }

  let imported = 0;
  let migrated = 0;
  let skipped = 0;

  for (const [name, payload] of Object.entries(songsAny)) {
    const trimmed = (name || "").trim();
    if (!trimmed) continue;

    const incoming = parseIncomingSong(trimmed, payload, fileVersion);
    if (!incoming) continue;

    const incomingFp = docFingerprintV2(incoming.doc, incoming.transpose);
    const existingFp = existingSongFingerprint(trimmed);

    const saveIncoming = (targetName: string) => {
      saveSongDocV2(targetName, incoming.doc, incoming.transpose, incoming.category, incoming.subcategory);
      imported++;
      if (incoming.migrated) migrated++;
    };

    if (!existingFp) {
      saveIncoming(trimmed);
      continue;
    }

    if (existingFp === incomingFp) {
      skipped++;
      continue;
    }

    const existingDoc = loadSongDocV2(trimmed) ?? migrateV1ToV2(loadSongDoc(trimmed)!);
    const a = summarizeDocV2(existingDoc);
    const b = summarizeDocV2(incoming.doc);

    const choice = await options.askImportChoice(
      `La canción "${trimmed}" ya existe.\n\nActual:\n${a}\n\nNueva:\n${b}\n\n¿Qué querés hacer?`
    );
    if (choice === "skip") {
      skipped++;
      continue;
    }
    if (choice === "overwrite") {
      saveIncoming(trimmed);
      continue;
    }
    const newName = await options.askSaveAsName(trimmed);
    if (!newName) {
      skipped++;
      continue;
    }
    saveIncoming(newName);
  }

  return { imported, migrated, skipped };
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

export function base64UrlToBytes(b64url: string): Uint8Array {
  const cleaned = (b64url || "").replace(/[\r\n\s]/g, "");
  const b64 = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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

export async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const DS: any = (globalThis as any).DecompressionStream;
  if (!DS) {
    throw new Error("Tu navegador no soporta códigos comprimidos (gzip). Probá exportar el código en un navegador moderno.");
  }
  const ds = new DS("gzip");
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

export type ParsedShareCode = {
  version: 6 | 7;
  parsed: unknown;
};

export async function parseShareCode(raw: string): Promise<ParsedShareCode> {
  const trimmed = (raw || "").trim();
  if (!trimmed) throw new Error("Pegá un código.");

  const isGz6 = trimmed.startsWith("OC6GZ:");
  const isPlain6 = trimmed.startsWith("OC6:");
  const isGz7 = trimmed.startsWith("OC7GZ:");
  const isPlain7 = trimmed.startsWith("OC7:");
  if (!isGz6 && !isPlain6 && !isGz7 && !isPlain7) {
    throw new Error("El código debe empezar con OC6:, OC6GZ:, OC7: u OC7GZ:.");
  }

  const payload = trimmed.split(":").slice(1).join(":") || "";
  if (!payload) throw new Error("El código parece incompleto.");

  let bytes = base64UrlToBytes(payload);
  if (isGz6 || isGz7) bytes = await gunzipBytes(bytes);

  let parsed: unknown;
  try {
    const json = new TextDecoder().decode(bytes);
    parsed = JSON.parse(json);
  } catch {
    throw new Error("El código no contiene un JSON válido.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Código inválido.");

  const version = (parsed as { version?: number }).version;
  if (version !== 6 && version !== 7) {
    throw new Error("El código no es un compendio v6/v7 válido.");
  }
  const songs = (parsed as { songs?: unknown }).songs;
  if (!songs || typeof songs !== "object") {
    throw new Error("El código no es un compendio v6/v7 válido.");
  }
  const songNames = Object.keys(songs as object);
  if (songNames.length !== 1) {
    throw new Error("El código debe contener exactamente 1 canción.");
  }

  return { version: version as 6 | 7, parsed };
}

export async function makeSongShareCode(name: string): Promise<string | null> {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const bundle = exportBundleForNames([trimmed]);
  if (!bundle.songs[trimmed]) return null;
  const json = JSON.stringify(bundle);
  const raw = new TextEncoder().encode(json);
  const gz = await gzipBytes(raw);
  if (gz) return `OC7GZ:${base64UrlFromBytes(gz)}`;
  return `OC7:${base64UrlFromBytes(raw)}`;
}

export function clearAllSongs() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY_V7);
    localStorage.removeItem(LS_KEY_V6);
    localStorage.removeItem(LS_KEY_V5);
    localStorage.removeItem(LS_KEY_V4);
    localStorage.removeItem("ocarina.songs.v3");
    localStorage.removeItem("ocarina.songs.v2");
    localStorage.removeItem("ocarina.songs.v1");
    localStorage.removeItem(LS_KEY_DRAFT_V2);
  } catch {}
}

export function listSongsWithCategories(): Array<{ name: string; category: string; subcategory: string; format: "v1" | "v2" }> {
  const v6 = readStoreV6();
  const v7 = readStoreV7();
  const names = listSongNames();
  return names
    .map((n) => {
      const entryV7 = v7[n];
      if (entryV7) {
        return {
          name: n,
          category: entryV7.category || "",
          subcategory: entryV7.subcategory || "",
          format: "v2" as const,
        };
      }
      const entryV6 = v6[n];
      return {
        name: n,
        category: entryV6?.category || "",
        subcategory: entryV6?.subcategory || "",
        format: "v1" as const,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listCategories(): string[] {
  const set = new Set<string>();
  for (const s of listSongsWithCategories()) {
    const c = (s.category || "").trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function setSongCategory(name: string, category: string) {
  const v7 = readStoreV7();
  if (v7[name]) {
    v7[name].category = (category || "").trim();
    writeStoreV7(v7);
    return;
  }
  const store = readStoreV6();
  if (!store[name]) return;
  store[name].category = (category || "").trim();
  writeStoreV6(store);
}

export function setSongSubcategory(name: string, subcategory: string) {
  const v7 = readStoreV7();
  if (v7[name]) {
    v7[name].subcategory = (subcategory || "").trim();
    writeStoreV7(v7);
    return;
  }
  const store = readStoreV6();
  if (!store[name]) return;
  store[name].subcategory = (subcategory || "").trim();
  writeStoreV6(store);
}

export function renameCategory(oldName: string, newName: string) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (typeof window === "undefined") return;
  const storeV6 = readStoreV6();
  const storeV7 = readStoreV7();

  let changedV6 = false;
  for (const v of Object.values(storeV6)) {
    const cur = (v?.category || "").trim();
    if (cur === from) {
      v.category = to;
      changedV6 = true;
    }
  }
  if (changedV6) writeStoreV6(storeV6);

  let changedV7 = false;
  for (const v of Object.values(storeV7)) {
    const cur = (v?.category || "").trim();
    if (cur === from) {
      v.category = to;
      changedV7 = true;
    }
  }
  if (changedV7) writeStoreV7(storeV7);
}

export function renameSubcategory(oldName: string, newName: string) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (typeof window === "undefined") return;
  const storeV6 = readStoreV6();
  const storeV7 = readStoreV7();

  let changedV6 = false;
  for (const v of Object.values(storeV6)) {
    const cur = (v?.subcategory || "").trim();
    if (cur === from) {
      v.subcategory = to;
      changedV6 = true;
    }
  }
  if (changedV6) writeStoreV6(storeV6);

  let changedV7 = false;
  for (const v of Object.values(storeV7)) {
    const cur = (v?.subcategory || "").trim();
    if (cur === from) {
      v.subcategory = to;
      changedV7 = true;
    }
  }
  if (changedV7) writeStoreV7(storeV7);
}

export function renameSong(oldName: string, newName: string) {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (!from || !to) return;

  const storeV7 = readStoreV7();
  if (storeV7[from]) {
    storeV7[to] = storeV7[from];
    if (from !== to) delete storeV7[from];
    writeStoreV7(storeV7);
  }

  const storeV6 = readStoreV6();
  if (storeV6[from]) {
    storeV6[to] = storeV6[from];
    if (from !== to) delete storeV6[from];
    writeStoreV6(storeV6);
  }
}

export { createEmptySongDocV2 };

