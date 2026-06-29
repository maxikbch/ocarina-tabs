import { nanoid } from "nanoid";
import { getFingeringForNote, EMPTY } from "@/lib/fingerings";
import type { Fingering, NoteEvent, NoteId } from "@/lib/types";
import type { SongDoc, SongItem, SongSectionDef } from "@/lib/songDoc";
import type { SongDocV2, TimedEvent } from "@/lib/songDocV2";
import { sortEventsByTick, tickOf } from "@/lib/songDocV2";
import { getVisibleEvents, hasVoiceLayers } from "@/lib/songVoices";

export function flattenSectionEvents(events: TimedEvent[]): string[] {
  const sorted = sortEventsByTick(events);
  const out: string[] = [];
  for (const ev of sorted) {
    if (ev.kind === "marker" && ev.marker === "line-break") {
      out.push("⏎");
    } else if (ev.kind === "note") {
      out.push(ev.note);
    }
  }
  return out;
}

export type FlatSongV2 = {
  events: NoteEvent[];
  idToRef: Record<string, { sectionId: string; itemId: string }>;
};

export function flattenDocV2ForPlay(doc: SongDocV2, opts?: { visibleOnly?: boolean }): FlatSongV2 {
  const events: NoteEvent[] = [];
  const idToRef: Record<string, { sectionId: string; itemId: string }> = {};
  const filterVisible = opts?.visibleOnly !== false && hasVoiceLayers(doc);

  for (const inst of doc.arrangement) {
    const sec = doc.sectionsById[inst.sectionId];
    if (!sec) continue;

    const rawEvents = filterVisible ? getVisibleEvents(sec.events, doc) : sec.events;
    const sorted = sortEventsByTick(rawEvents);
    for (const ev of sorted) {
      if (ev.kind === "marker" && ev.marker === "line-break") {
        const id = `${inst.id}:${ev.id}`;
        idToRef[id] = { sectionId: sec.id, itemId: ev.id };
        const baseF = getFingeringForNote("C4" as NoteId, EMPTY);
        const snapshot: Fingering =
          typeof structuredClone === "function" ? structuredClone(baseF) : { ...baseF };
        events.push({ id, note: "⏎" as NoteId, fingering: snapshot });
      } else if (ev.kind === "note") {
        const id = `${inst.id}:${ev.id}`;
        idToRef[id] = { sectionId: sec.id, itemId: ev.id };
        const baseF = getFingeringForNote(ev.note as NoteId, EMPTY);
        const snapshot: Fingering =
          typeof structuredClone === "function" ? structuredClone(baseF) : { ...baseF };
        events.push({ id, note: ev.note as NoteId, fingering: snapshot });
      }
    }
  }

  return { events, idToRef };
}

export function songDocV2ToSongDocV1(doc: SongDocV2): SongDoc {
  const sectionsById: Record<string, SongSectionDef> = {};

  for (const [id, sec] of Object.entries(doc.sectionsById)) {
    const items: SongItem[] = [];
    const sorted = sortEventsByTick(sec.events);
    for (const ev of sorted) {
      if (ev.kind === "marker" && ev.marker === "line-break") {
        items.push({ id: ev.id, note: "⏎" });
      } else if (ev.kind === "note") {
        items.push({ id: ev.id, note: ev.note });
      }
    }
    sectionsById[id] = { id, name: sec.name, items };
  }

  return {
    version: 1,
    sectionsById,
    arrangement: doc.arrangement.map((inst) => ({ ...inst })),
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
