"use client";

import { nanoid } from "nanoid";
import { shiftNote } from "@/lib/notes";
import type { NoteId } from "@/lib/types";

export type SongItem = {
  id: string;
  note: string; // NoteId or special tokens like "—" / "⏎"
};

export type SongSectionDef = {
  id: string;
  name: string; // unique among defs
  items: SongItem[];
};

export type SongSectionInstance = {
  id: string;
  sectionId: string;
};

export type SongDoc = {
  version: 1;
  sectionsById: Record<string, SongSectionDef>;
  arrangement: SongSectionInstance[]; // may repeat sectionId (replicas)
};

export function createEmptySongDoc(): SongDoc {
  const sectionId = nanoid();
  const instanceId = nanoid();
  return {
    version: 1,
    sectionsById: {
      [sectionId]: { id: sectionId, name: "General", items: [] },
    },
    arrangement: [{ id: instanceId, sectionId }],
  };
}

export function isSpecialToken(note: string): boolean {
  return note === "—" || note === "SPACE" || note === "⏎" || note === "BR" || note === "SALTO";
}

export function normalizeSectionName(input: string | null | undefined): string {
  const trimmed = (input ?? "").trim();
  return trimmed || "General";
}

export function makeUniqueSectionName(desired: string, existingNames: string[]): string {
  const base = normalizeSectionName(desired);
  const used = new Set(existingNames.map((n) => n.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let i = 2;
  while (true) {
    const candidate = `${base} ${i}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
    i++;
  }
}

export function duplicateItemsWithNewIds(items: SongItem[]): SongItem[] {
  return items.map((it) => ({ id: nanoid(), note: it.note }));
}

export function songDocToStorage(doc: SongDoc): {
  sections: Record<string, { name: string; notes: string[] }>;
  arrangement: Array<{ sectionId: string }>;
} {
  const sections: Record<string, { name: string; notes: string[] }> = {};
  for (const [id, s] of Object.entries(doc.sectionsById)) {
    sections[id] = { name: s.name, notes: s.items.map((i) => i.note) };
  }
  const arrangement = doc.arrangement.map((inst) => ({ sectionId: inst.sectionId }));
  return { sections, arrangement };
}

export function songDocFromStorage(payload: {
  sections: Record<string, { name: string; notes: string[] }>;
  arrangement: Array<{ sectionId: string }>;
}): SongDoc {
  const sectionsById: Record<string, SongSectionDef> = {};
  for (const [id, s] of Object.entries(payload.sections || {})) {
    sectionsById[id] = {
      id,
      name: typeof s?.name === "string" ? s.name : "General",
      items: Array.isArray(s?.notes) ? s.notes.map((n) => ({ id: nanoid(), note: String(n) })) : [],
    };
  }
  const arrangement: SongSectionInstance[] = (payload.arrangement || [])
    .filter((a) => a && typeof a.sectionId === "string" && sectionsById[a.sectionId])
    .map((a) => ({ id: nanoid(), sectionId: a.sectionId }));

  // Ensure at least one section/instance exists
  if (Object.keys(sectionsById).length === 0 || arrangement.length === 0) {
    return createEmptySongDoc();
  }

  // Ensure unique names among defs (best-effort)
  const seen = new Set<string>();
  for (const s of Object.values(sectionsById)) {
    const lower = s.name.toLowerCase();
    if (seen.has(lower)) {
      const unique = makeUniqueSectionName(s.name, Object.values(sectionsById).map((x) => x.name));
      s.name = unique;
    }
    seen.add(s.name.toLowerCase());
  }

  return { version: 1, sectionsById, arrangement };
}

export type FlatItemRef = {
  instanceId: string;
  sectionId: string;
  itemId: string;
};

export function flattenDoc(doc: SongDoc): FlatItemRef[] {
  const out: FlatItemRef[] = [];
  for (const inst of doc.arrangement) {
    const sec = doc.sectionsById[inst.sectionId];
    if (!sec) continue;
    for (const it of sec.items) {
      out.push({ instanceId: inst.id, sectionId: sec.id, itemId: it.id });
    }
  }
  return out;
}

export function getDisplayNote(note: string, transpose: number): string {
  if (!transpose) return note;
  if (isSpecialToken(note)) return note;
  return shiftNote(note as NoteId, -transpose);
}

