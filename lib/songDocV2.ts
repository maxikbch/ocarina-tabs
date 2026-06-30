"use client";

import { nanoid } from "nanoid";
import { normalizeSectionName } from "@/lib/songDoc";
import { pruneImplicitIntro } from "@/lib/sectionMarkers";
import { createEmptySongDocV2Normalized, normalizeSongDocV2 } from "@/lib/songDocV2Normalize";

export type PPQ = number;
export type Tick = number;

export const SONG_TIMELINE_ID = "song";

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

export type SectionColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TimedNote = {
  kind: "note";
  id: string;
  note: string;
  start: Tick;
  duration: Tick;
  voiceId?: string;
};

export type LayoutMarkerType = "line-break" | "space" | "section";

export type LineBreakMarker = {
  kind: "marker";
  id: string;
  tick: Tick;
  marker: "line-break";
};

export type SpaceMarker = {
  kind: "marker";
  id: string;
  tick: Tick;
  marker: "space";
};

export type SectionMarker = {
  kind: "marker";
  id: string;
  tick: Tick;
  marker: "section";
  name: string;
  color: SectionColorIndex;
  placedManually: boolean;
};

export type LayoutMarker = LineBreakMarker | SpaceMarker | SectionMarker;

export type TimedEvent = TimedNote | LayoutMarker;

export type ImplicitIntro = {
  name: string;
  color: SectionColorIndex;
};

export type SongLayout = {
  /** Si false, no se insertan espacios automáticos entre notas (los manuales siguen funcionando). */
  autoSpacesEnabled?: boolean;
  autoSpaceUnit?: "quarter" | "eighth";
  autoSpaceMinTicks?: number;
  implicitIntro?: ImplicitIntro;
};

/** @deprecated Legacy — migrado a `events` por normalizeSongDocV2 */
export type SongSectionDefV2 = {
  id: string;
  name: string;
  events: TimedEvent[];
};

export type SongDocV2 = {
  version: 2;
  timing: SongTiming;
  events: TimedEvent[];
  voices?: Record<string, VoiceDef>;
  importSource?: ImportSource;
  layout?: SongLayout;
  /** @deprecated */
  sectionsById?: Record<string, SongSectionDefV2>;
  /** @deprecated */
  arrangement?: Array<{ id: string; sectionId: string }>;
};

export function createDefaultTiming(): SongTiming {
  return { tempo: DEFAULT_TEMPO, ppq: DEFAULT_PPQ };
}

export function createEmptySongDocV2(): SongDocV2 {
  return createEmptySongDocV2Normalized();
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

export function isSectionMarker(event: TimedEvent): event is SectionMarker {
  return event.kind === "marker" && event.marker === "section";
}

export function isLineBreakMarker(event: TimedEvent): event is LineBreakMarker {
  return event.kind === "marker" && event.marker === "line-break";
}

export function isSpaceMarker(event: TimedEvent): event is SpaceMarker {
  return event.kind === "marker" && event.marker === "space";
}

export function duplicateEventsWithNewIds(events: TimedEvent[]): TimedEvent[] {
  return events.map((ev) => {
    if (ev.kind === "note") {
      return { ...ev, id: nanoid() };
    }
    return { ...ev, id: nanoid() };
  });
}

export function cloneSongDocV2(doc: SongDocV2): SongDocV2 {
  const normalized = normalizeSongDocV2(doc);
  return {
    ...normalized,
    timing: { ...normalized.timing },
    events: structuredClone(normalized.events),
    layout: normalized.layout ? { ...normalized.layout } : undefined,
    voices: normalized.voices ? structuredClone(normalized.voices) : undefined,
    importSource: normalized.importSource ? { ...normalized.importSource } : undefined,
  };
}

export function finalizeSongDocV2(doc: SongDocV2): SongDocV2 {
  let next = pruneImplicitIntro(normalizeSongDocV2(doc));
  const layoutByTick = new Map<number, import("@/lib/songDocV2").LayoutMarker>();
  const notes: TimedNote[] = [];
  for (const ev of next.events) {
    if (ev.kind === "note") notes.push(ev);
    else if (isLayoutMarker(ev)) layoutByTick.set(ev.tick, ev);
  }
  next.events = sortEventsByTick([...notes, ...layoutByTick.values()]);
  return next;
}

export function patchSongDocV2(doc: SongDocV2, mut: (draft: SongDocV2) => void): SongDocV2 {
  const next = cloneSongDocV2(doc);
  mut(next);
  return finalizeSongDocV2(next);
}

export { normalizeSectionName };

function layoutMarkerRank(event: TimedEvent): number {
  if (event.kind !== "marker") return 3;
  if (event.marker === "section") return 0;
  if (event.marker === "line-break") return 1;
  if (event.marker === "space") return 2;
  return 3;
}

export function sortEventsByTick(events: TimedEvent[]): TimedEvent[] {
  return [...events].filter((e) => e.kind === "note" || isLayoutMarker(e)).sort((a, b) => {
    const tickDiff = tickOf(a) - tickOf(b);
    if (tickDiff !== 0) return tickDiff;
    const rankDiff = layoutMarkerRank(a) - layoutMarkerRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.id.localeCompare(b.id);
  });
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
  return JSON.stringify({ doc: normalizeSongDocV2(doc), transpose });
}

export { normalizeSongDocV2 } from "@/lib/songDocV2Normalize";
