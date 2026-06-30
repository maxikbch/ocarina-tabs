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

export function getAutoSpaceUnitTicks(timing: SongTiming, layout?: SongLayout): number {
  return layout?.autoSpaceUnit === "eighth" ? timing.ppq / 2 : timing.ppq;
}

export function getAutoSpaceMinTicks(timing: SongTiming, layout?: SongLayout): number {
  if (layout?.autoSpaceMinTicks != null) return layout.autoSpaceMinTicks;
  return Math.floor(timing.ppq * DEFAULT_AUTO_SPACE_MIN_RATIO);
}

export function computeAutoSpaceCount(gap: number, timing: SongTiming, layout?: SongLayout): number {
  if (gap <= 0) return 0;
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
  if (lastTokenIsSpace(out)) out.pop();
  if (lastTokenIsSection(out)) out.pop();
  out.push(token);
}

function pushLineBreak(out: LayoutTabToken[], token: Extract<LayoutTabToken, { kind: "line-break" }>) {
  if (lastTokenIsSpace(out)) out.pop();
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
  if (computeAutoSpaceCount(gap, timing, layout) > 0) {
    pushSpace(out, { kind: "space", auto: true });
  }
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
  const out: LayoutTabToken[] = [];
  let lastSoundEnd = 0;

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

    pushAutoSpaceIfGap(out, Math.max(0, tick - lastSoundEnd), doc.timing, doc.layout);

    let clusterEnd = lastSoundEnd;
    for (const item of group) {
      if (item.kind === "marker") {
        if (isSectionMarker(item.marker)) {
          pushSection(out, {
            kind: "section",
            name: item.marker.name,
            color: item.marker.color,
            sourceId: item.marker.id,
          });
        } else if (isLineBreakMarker(item.marker)) {
          pushLineBreak(out, { kind: "line-break", sourceId: item.marker.id });
        } else if (isSpaceMarker(item.marker)) {
          pushSpace(out, { kind: "space", sourceId: item.marker.id });
        }
      } else {
        for (const note of item.notes) {
          out.push({ kind: "note", note: note.note, sourceId: note.id });
        }
        clusterEnd = Math.max(clusterEnd, ...item.notes.map((n) => n.start + n.duration));
      }
    }

    lastSoundEnd = Math.max(lastSoundEnd, clusterEnd);
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
    } else if (token.kind === "space") {
      const id = token.sourceId ?? `auto-space-${current.events.length}`;
      const ev = noteEventsBySourceId.get(id);
      if (ev) current.events.push(ev);
    } else if (token.kind === "line-break") {
      const id = token.sourceId ?? `line-break-${current.events.length}`;
      const ev = noteEventsBySourceId.get(id);
      if (ev) current.events.push(ev);
    }
  }

  if (current && current.events.length > 0) sections.push(current);
  if (sections.length === 0 && current) return [current];
  return sections;
}
