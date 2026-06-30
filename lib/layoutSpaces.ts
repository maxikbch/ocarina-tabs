import type { ImplicitIntro, SectionColorIndex, SongDocV2, SongLayout, SongTiming, TimedEvent, TimedNote } from "@/lib/songDocV2";
import { isLineBreakMarker, isSectionMarker, isSpaceMarker, sortEventsByTick } from "@/lib/songDocV2";
import {
  defaultImplicitIntro,
  hasStoredSectionMarkers,
  IMPLICIT_INTRO_MARKER_ID,
  listStoredSectionMarkers,
} from "@/lib/sectionMarkers";
import type { NoteEvent } from "@/lib/types";

export type LayoutTabToken =
  | { kind: "note"; note: string; sourceId?: string }
  | { kind: "space"; sourceId?: string; auto?: boolean }
  | { kind: "line-break"; sourceId?: string }
  | { kind: "section"; name: string; color: SectionColorIndex; sourceId?: string; implicit?: boolean };

const DEFAULT_AUTO_SPACE_MIN_RATIO = 0.5;

export function isAutoSpacesEnabled(layout?: SongLayout): boolean {
  return layout?.autoSpacesEnabled !== false;
}

export function getAutoSpaceUnitTicks(timing: SongTiming, layout?: SongLayout): number {
  return layout?.autoSpaceUnit === "eighth" ? timing.ppq / 2 : timing.ppq;
}

export function getAutoSpaceMinTicks(timing: SongTiming, layout?: SongLayout): number {
  if (layout?.autoSpaceMinTicks != null) return layout.autoSpaceMinTicks;
  return Math.floor(getAutoSpaceUnitTicks(timing, layout) * DEFAULT_AUTO_SPACE_MIN_RATIO);
}

export function computeAutoSpaceCount(gap: number, timing: SongTiming, layout?: SongLayout): number {
  if (gap <= 0 || !isAutoSpacesEnabled(layout)) return 0;
  const minTicks = getAutoSpaceMinTicks(timing, layout);
  if (gap < minTicks) return 0;
  return 1;
}

function lastToken(out: LayoutTabToken[]): LayoutTabToken | undefined {
  return out[out.length - 1];
}

function lastTokenIsSpace(out: LayoutTabToken[]): boolean {
  return lastToken(out)?.kind === "space";
}

function lastTokenIsSection(out: LayoutTabToken[]): boolean {
  return lastToken(out)?.kind === "section";
}

function pushSection(out: LayoutTabToken[], token: Extract<LayoutTabToken, { kind: "section" }>) {
  const last = lastToken(out);
  if (last?.kind === "space") out.pop();
  if (lastTokenIsSection(out)) out.pop();
  out.push(token);
}

function pushLineBreak(out: LayoutTabToken[], token: Extract<LayoutTabToken, { kind: "line-break" }>) {
  const last = lastToken(out);
  if (last?.kind === "space") out.pop();
  if (lastTokenIsSection(out)) return;
  out.push(token);
}

function pushSpace(out: LayoutTabToken[], token: Extract<LayoutTabToken, { kind: "space" }>) {
  if (lastTokenIsSpace(out)) return;
  if (lastToken(out)?.kind === "line-break") return;
  if (lastTokenIsSection(out)) return;
  out.push(token);
}

function pushAutoSpaceIfGap(
  out: LayoutTabToken[],
  gap: number,
  timing: SongTiming,
  layout?: SongLayout
) {
  if (computeAutoSpaceCount(gap, timing, layout) <= 0) return;
  const last = lastToken(out);
  if (last?.kind === "section" || last?.kind === "line-break") return;
  if (lastTokenIsSpace(out)) return;
  out.push({ kind: "space", auto: true });
}

function collectTimedNotes(events: TimedEvent[]): TimedNote[] {
  return events.filter((e): e is TimedNote => e.kind === "note");
}

/** Fin del sonido más reciente que ya terminó en o antes de `tick` (ignora notas que aún suenan). */
function maxSoundEndAtOrBefore(notes: TimedNote[], tick: number): number {
  let maxEnd = 0;
  for (const n of notes) {
    const end = n.start + n.duration;
    if (end <= tick) maxEnd = Math.max(maxEnd, end);
  }
  return maxEnd;
}

function silenceGapBeforeTick(notes: TimedNote[], tick: number): number {
  return Math.max(0, tick - maxSoundEndAtOrBefore(notes, tick));
}

type ClusterItem = { kind: "cluster"; tick: number; notes: TimedNote[] };
type MarkerItem = { kind: "marker"; tick: number; marker: TimedEvent };
type TimelineItem = ClusterItem | MarkerItem;

function layoutItemRank(item: TimelineItem): number {
  if (item.kind === "marker" && isSectionMarker(item.marker)) return 0;
  if (item.kind === "marker" && isLineBreakMarker(item.marker)) return 1;
  if (item.kind === "marker" && isSpaceMarker(item.marker)) return 2;
  return 3;
}

function compareTimelineItems(a: TimelineItem, b: TimelineItem): number {
  if (a.tick !== b.tick) return a.tick - b.tick;
  const rankDiff = layoutItemRank(a) - layoutItemRank(b);
  if (rankDiff !== 0) return rankDiff;
  if (a.kind === "marker" && b.kind === "marker") return a.marker.id.localeCompare(b.marker.id);
  return 0;
}

function buildTimelineItems(events: TimedEvent[]): TimelineItem[] {
  const sorted = sortEventsByTick(events);
  const clusterMap = new Map<number, TimedNote[]>();
  const items: TimelineItem[] = [];

  for (const ev of sorted) {
    if (ev.kind === "note") {
      const list = clusterMap.get(ev.start) ?? [];
      list.push(ev);
      clusterMap.set(ev.start, list);
    } else if (ev.kind === "marker") {
      items.push({ kind: "marker", tick: ev.tick, marker: ev });
    }
  }

  for (const [tick, notes] of clusterMap) {
    items.push({ kind: "cluster", tick, notes });
  }

  items.sort(compareTimelineItems);
  return items;
}

function implicitIntroForFlatten(doc: Pick<SongDocV2, "events" | "layout">): ImplicitIntro | null {
  if (!hasStoredSectionMarkers(doc.events)) return null;
  if (listStoredSectionMarkers(doc.events).some((m) => m.tick === 0)) return null;
  return doc.layout?.implicitIntro ?? defaultImplicitIntro();
}

/** Aplana eventos a tokens de tabs: secciones, espacios auto + manuales, saltos y notas. */
export function flattenSongLayoutTokens(
  doc: Pick<SongDocV2, "events" | "timing" | "layout">
): LayoutTabToken[] {
  const items = buildTimelineItems(doc.events);
  const allNotes = collectTimedNotes(doc.events);
  const out: LayoutTabToken[] = [];
  let lastNoteClusterTick = -1;

  const intro = implicitIntroForFlatten(doc);
  if (intro) {
    pushSection(out, {
      kind: "section",
      name: intro.name,
      color: intro.color,
      sourceId: IMPLICIT_INTRO_MARKER_ID,
      implicit: true,
    });
  }

  let i = 0;
  while (i < items.length) {
    const tick = items[i].tick;
    const group: TimelineItem[] = [];
    while (i < items.length && items[i].tick === tick) {
      group.push(items[i]);
      i++;
    }

    let gap = silenceGapBeforeTick(allNotes, tick);
    if (lastNoteClusterTick >= 0) {
      const unit = getAutoSpaceUnitTicks(doc.timing, doc.layout);
      if (tick - lastNoteClusterTick >= 2 * unit) {
        gap = Math.max(gap, unit);
      }
    }
    const notesInGroup: TimedNote[] = [];
    let sectionMarker: Extract<TimedEvent, { kind: "marker" }> | null = null;
    let lineBreakMarker: Extract<TimedEvent, { kind: "marker" }> | null = null;
    let spaceMarker: Extract<TimedEvent, { kind: "marker" }> | null = null;

    for (const item of group) {
      if (item.kind === "cluster") {
        notesInGroup.push(...item.notes);
      } else if (item.kind === "marker") {
        if (isSectionMarker(item.marker)) sectionMarker = item.marker;
        else if (isLineBreakMarker(item.marker)) lineBreakMarker = item.marker;
        else if (isSpaceMarker(item.marker)) spaceMarker = item.marker;
      }
    }

    // Entre notas: a lo sumo un separador — sección > salto > espacio (manual o auto).
    if (sectionMarker && isSectionMarker(sectionMarker)) {
      pushSection(out, {
        kind: "section",
        name: sectionMarker.name,
        color: sectionMarker.color,
        sourceId: sectionMarker.id,
      });
    } else if (lineBreakMarker && isLineBreakMarker(lineBreakMarker)) {
      pushLineBreak(out, { kind: "line-break", sourceId: lineBreakMarker.id });
    } else if (spaceMarker && isSpaceMarker(spaceMarker)) {
      pushSpace(out, { kind: "space", sourceId: spaceMarker.id });
    } else if (notesInGroup.length > 0) {
      pushAutoSpaceIfGap(out, gap, doc.timing, doc.layout);
    }

    if (notesInGroup.length > 0) {
      for (const note of notesInGroup) {
        out.push({ kind: "note", note: note.note, sourceId: note.id });
      }
      lastNoteClusterTick = tick;
    }
  }

  return out;
}

/** @deprecated Usar flattenSongLayoutTokens(doc) */
export function flattenSectionLayoutTokens(
  events: TimedEvent[],
  timing: SongTiming,
  layout?: SongLayout
): LayoutTabToken[] {
  return flattenSongLayoutTokens({ events, timing, layout });
}

export function autoSpaceEventId(index: number): string {
  return `auto-space:${index}`;
}

export function resolveLayoutTokenEventId(token: LayoutTabToken, autoSpaceIdx: number): string | null {
  if (token.kind === "note" && token.sourceId) return token.sourceId;
  if (token.kind === "line-break" && token.sourceId) return token.sourceId;
  if (token.kind === "space" && token.sourceId) return token.sourceId;
  if (token.kind === "space" && token.auto) return autoSpaceEventId(autoSpaceIdx);
  return null;
}

export function layoutTokensToNotes(tokens: LayoutTabToken[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    if (token.kind === "note") out.push(token.note);
    else if (token.kind === "space") out.push("—");
    else if (token.kind === "line-break") out.push("⏎");
  }
  return out;
}

export type PlaySectionSlice = {
  instanceId: string;
  name: string;
  color?: SectionColorIndex;
  events: NoteEvent[];
};

export function buildPlaySectionsFromTokens(
  tokens: LayoutTabToken[],
  noteEventsBySourceId: Map<string, NoteEvent>
): PlaySectionSlice[] {
  const sections: PlaySectionSlice[] = [];
  let current: PlaySectionSlice | null = null;

  const startSection = (name: string, color?: SectionColorIndex, id?: string) => {
    if (current && current.events.length > 0) sections.push(current);
    current = {
      instanceId: id ?? `section-${sections.length}`,
      name,
      color,
      events: [],
    };
  };

  let autoSpaceIdx = 0;
  for (const token of tokens) {
    if (token.kind === "section") {
      startSection(token.name, token.color, token.sourceId);
      continue;
    }
    if (!current) {
      current = { instanceId: "section-0", name: "General", events: [] };
    }
    if (token.kind === "note" && token.sourceId) {
      const ev = noteEventsBySourceId.get(token.sourceId);
      if (ev) current.events.push(ev);
      continue;
    }
    const id = resolveLayoutTokenEventId(token, autoSpaceIdx);
    if (token.kind === "space" && token.auto) autoSpaceIdx++;
    if (!id) continue;
    const ev = noteEventsBySourceId.get(id);
    if (ev) current.events.push(ev);
  }

  if (current && current.events.length > 0) sections.push(current);
  if (sections.length === 0 && current) return [current];
  return sections;
}
