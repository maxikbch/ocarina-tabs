import { nanoid } from "nanoid";
import { getFingeringForNote, EMPTY } from "@/lib/fingerings";
import {
  buildPlaySectionsFromTokens,
  flattenSongLayoutTokens,
  type LayoutTabToken,
} from "@/lib/layoutSpaces";
import type { Fingering, NoteEvent, NoteId } from "@/lib/types";
import type { SongDoc, SongItem, SongSectionDef } from "@/lib/songDoc";
import type { SongDocV2, TimedEvent } from "@/lib/songDocV2";
import { normalizeSongDocV2, tickOf } from "@/lib/songDocV2";
import { getVisibleEvents, hasVoiceLayers } from "@/lib/songVoices";

function fingeringSnapshot(note: NoteId): Fingering {
  const baseF = getFingeringForNote(note, EMPTY);
  return typeof structuredClone === "function" ? structuredClone(baseF) : { ...baseF };
}

function tokenToNoteEvent(token: LayoutTabToken, id: string): NoteEvent | null {
  if (token.kind === "note") {
    return { id, note: token.note as NoteId, fingering: fingeringSnapshot(token.note as NoteId) };
  }
  if (token.kind === "space") {
    return { id, note: "—" as NoteId, fingering: fingeringSnapshot("C4" as NoteId) };
  }
  if (token.kind === "line-break") {
    return { id, note: "⏎" as NoteId, fingering: fingeringSnapshot("C4" as NoteId) };
  }
  return null;
}

function tokenToFlatId(token: LayoutTabToken, autoSpaceIdx: number): string | null {
  if (token.kind === "section") return null;
  if (token.kind === "note" && token.sourceId) return token.sourceId;
  if (token.kind === "line-break" && token.sourceId) return token.sourceId;
  if (token.kind === "space" && token.sourceId) return token.sourceId;
  if (token.kind === "space" && token.auto) return `auto-space:${autoSpaceIdx}`;
  return null;
}

export function flattenSectionEvents(doc: Pick<SongDocV2, "events" | "timing" | "layout">): string[] {
  const tokens = flattenSongLayoutTokens(doc);
  const out: string[] = [];
  for (const token of tokens) {
    if (token.kind === "note") out.push(token.note);
    else if (token.kind === "space") out.push("—");
    else if (token.kind === "line-break") out.push("⏎");
  }
  return out;
}

export type FlatSongV2 = {
  events: NoteEvent[];
  idToRef: Record<string, { sectionId: string; itemId: string }>;
  playSections: ReturnType<typeof buildPlaySectionsFromTokens>;
};

export function flattenDocV2ForPlay(doc: SongDocV2, opts?: { visibleOnly?: boolean }): FlatSongV2 {
  const normalized = normalizeSongDocV2(doc);
  const events: NoteEvent[] = [];
  const idToRef: Record<string, { sectionId: string; itemId: string }> = {};
  const filterVisible = opts?.visibleOnly !== false && hasVoiceLayers(normalized);
  const rawEvents = filterVisible ? getVisibleEvents(normalized.events, normalized) : normalized.events;
  const tokens = flattenSongLayoutTokens({ ...normalized, events: rawEvents });

  let autoSpaceIdx = 0;
  const bySourceId = new Map<string, NoteEvent>();

  for (const token of tokens) {
    const id = tokenToFlatId(token, autoSpaceIdx);
    if (token.kind === "space" && token.auto) autoSpaceIdx++;
    if (!id) continue;

    const ev = tokenToNoteEvent(token, id);
    if (!ev) continue;
    idToRef[id] = { sectionId: "song", itemId: id };
    events.push(ev);
    bySourceId.set(id, ev);
  }

  const playSections = buildPlaySectionsFromTokens(tokens, bySourceId);

  return { events, idToRef, playSections };
}

export function songDocV2ToSongDocV1(doc: SongDocV2): SongDoc {
  const normalized = normalizeSongDocV2(doc);
  const items: SongItem[] = [];
  const tokens = flattenSongLayoutTokens(normalized);
  for (const token of tokens) {
    if (token.kind === "line-break") {
      items.push({ id: token.sourceId ?? nanoid(), note: "⏎" });
    } else if (token.kind === "space") {
      items.push({ id: token.sourceId ?? nanoid(), note: "—" });
    } else if (token.kind === "note") {
      items.push({ id: token.sourceId ?? nanoid(), note: token.note });
    }
  }

  const sectionId = nanoid();
  const instanceId = nanoid();
  return {
    version: 1,
    sectionsById: { [sectionId]: { id: sectionId, name: "General", items } },
    arrangement: [{ id: instanceId, sectionId }],
  };
}

export function getTimedNotesInSection(events: TimedEvent[]) {
  return events.filter((e): e is import("@/lib/songDocV2").TimedNote => e.kind === "note");
}

export function eventAtTick(events: TimedEvent[], tick: number): TimedEvent | null {
  let best: TimedEvent | null = null;
  let bestDist = Infinity;
  for (const ev of events) {
    const t = tickOf(ev);
    const dist = Math.abs(t - tick);
    if (dist < bestDist) {
      bestDist = dist;
      best = ev;
    }
  }
  return best;
}
