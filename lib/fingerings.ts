import type { Fingering, NoteId } from "./types";
import { HOLES } from "./ocarinaModel";
import NOTE_MAP from "./fingerings.json" assert { type: "json" };

export const EMPTY: Fingering = HOLES.reduce((acc, h) => {
  acc[h.id] = 0;
  return acc;
}, {} as Fingering);

// Nuevo formato en storage/JSON: array de HoleId tapados
export type FingeringArray = string[]; // HoleId[]
export const NOTE_TO_FINGERING_ARRAYS: Partial<Record<NoteId, FingeringArray>> = NOTE_MAP as any;

const LS_KEY = "ocarina.fingeringOverrides.v1";

function loadOverrides(): Partial<Record<NoteId, FingeringArray>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<NoteId, FingeringArray>>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(map: Partial<Record<NoteId, FingeringArray>>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {}
}

function arrayToRecord(arr: FingeringArray): Fingering {
  const rec: Fingering = { ...EMPTY };
  for (const id of arr) {
    if (id in rec) {
      (rec as any)[id] = 1;
    }
  }
  return rec;
}

function recordToArray(rec: Fingering): FingeringArray {
  const out: string[] = [];
  for (const h of HOLES) {
    if (rec[h.id] === 1) out.push(h.id);
  }
  return out;
}

export function getFingeringForNote(note: NoteId, fallback: Fingering): Fingering {
  const overrides = loadOverrides();
  const arr = overrides[note] ?? NOTE_TO_FINGERING_ARRAYS[note];
  return arr ? arrayToRecord(arr) : fallback;
}

export function setFingeringOverride(note: NoteId, fingering: Fingering) {
  const overrides = loadOverrides();
  overrides[note] = recordToArray(fingering);
  saveOverrides(overrides);
}

export function hasFingeringForNote(note: NoteId): boolean {
  const overrides = loadOverrides();
  return Boolean(overrides[note] ?? NOTE_TO_FINGERING_ARRAYS[note]);
}


