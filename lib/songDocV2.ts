"use client";

import { nanoid } from "nanoid";
import {
  getBaseSectionName,
  makeUniqueSectionName,
  normalizeSectionName,
  type SongSectionInstance,
} from "@/lib/songDoc";

export type PPQ = number;
export type Tick = number;

export type SongTiming = {
  tempo: number;
  ppq: PPQ;
};

export const DEFAULT_TEMPO = 120;
export const DEFAULT_PPQ = 480;

export type VoiceDef = {
  name: string;
  color: string;
  hidden: boolean;
};

export type ImportSource = {
  kind: "midi";
  fileName?: string;
  importedAt: string;
};

export type TimedNote = {
  kind: "note";
  id: string;
  note: string;
  start: Tick;
  duration: Tick;
  voiceId?: string;
};

export type LayoutMarkerType = "line-break";

export type LayoutMarker = {
  kind: "marker";
  id: string;
  tick: Tick;
  marker: LayoutMarkerType;
};

export type TimedEvent = TimedNote | LayoutMarker;

export type SongSectionDefV2 = {
  id: string;
  name: string;
  events: TimedEvent[];
};

export type SongDocV2 = {
  version: 2;
  timing: SongTiming;
  sectionsById: Record<string, SongSectionDefV2>;
  arrangement: SongSectionInstance[];
  voices?: Record<string, VoiceDef>;
  importSource?: ImportSource;
};

export function createDefaultTiming(): SongTiming {
  return { tempo: DEFAULT_TEMPO, ppq: DEFAULT_PPQ };
}

export function createEmptySongDocV2(): SongDocV2 {
  const sectionId = nanoid();
  const instanceId = nanoid();
  return {
    version: 2,
    timing: createDefaultTiming(),
    sectionsById: {
      [sectionId]: { id: sectionId, name: "General", events: [] },
    },
    arrangement: [{ id: instanceId, sectionId }],
  };
}

export function tickOf(event: TimedEvent): Tick {
  return event.kind === "note" ? event.start : event.tick;
}

export function isTimedNote(event: TimedEvent): event is TimedNote {
  return event.kind === "note";
}

export function isLayoutMarker(event: TimedEvent): event is LayoutMarker {
  return event.kind === "marker";
}

export function duplicateEventsWithNewIds(events: TimedEvent[]): TimedEvent[] {
  return events.map((ev) => {
    if (ev.kind === "note") {
      return { ...ev, id: nanoid() };
    }
    return { ...ev, id: nanoid() };
  });
}

export function sectionNamesV2(doc: SongDocV2): string[] {
  return Object.values(doc.sectionsById).map((s) => s.name);
}

export function makeUniqueSectionNameV2(desired: string, doc: SongDocV2): string {
  return makeUniqueSectionName(desired, sectionNamesV2(doc));
}

export { getBaseSectionName, makeUniqueSectionName, normalizeSectionName };

export function sortEventsByTick(events: TimedEvent[]): TimedEvent[] {
  return [...events].sort((a, b) => tickOf(a) - tickOf(b) || a.id.localeCompare(b.id));
}

export function getSectionEndTick(events: TimedEvent[]): Tick {
  let end = 0;
  for (const ev of events) {
    if (ev.kind === "note") {
      end = Math.max(end, ev.start + ev.duration);
    }
  }
  return end;
}

export function docFingerprintV2(doc: SongDocV2, transpose: number): string {
  return JSON.stringify({ doc, transpose });
}
