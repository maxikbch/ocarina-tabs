import type { ImplicitIntro, SectionColorIndex, SongDocV2, TimedEvent } from "@/lib/songDocV2";
import { isSectionMarker, sortEventsByTick } from "@/lib/songDocV2";

export const SECTION_MARKER_COLORS = [
  "#E57373",
  "#FFB74D",
  "#FFF176",
  "#81C784",
  "#64B5F6",
  "#BA68C8",
  "#4DD0E1",
] as const;

export const IMPLICIT_INTRO_MARKER_ID = "__implicit_intro__";

export type ResolvedSectionMarker = {
  id: string;
  tick: number;
  name: string;
  color: SectionColorIndex;
  implicit: boolean;
  placedManually: boolean;
};

export function sectionColorCss(color: SectionColorIndex): string {
  return SECTION_MARKER_COLORS[color] ?? SECTION_MARKER_COLORS[0];
}

export function pickSectionColor(avoid: SectionColorIndex[] = []): SectionColorIndex {
  const blocked = new Set<SectionColorIndex>(avoid);
  const all: SectionColorIndex[] = [0, 1, 2, 3, 4, 5, 6];
  const options = all.filter((i) => !blocked.has(i));
  const pool = options.length > 0 ? options : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function listStoredSectionMarkers(events: TimedEvent[]) {
  return sortEventsByTick(events).filter(isSectionMarker);
}

export function hasStoredSectionMarkers(events: TimedEvent[]): boolean {
  return events.some(isSectionMarker);
}

export function sectionMarkerAtTick(events: TimedEvent[], tick: number) {
  return listStoredSectionMarkers(events).find((m) => m.tick === tick) ?? null;
}

export function defaultImplicitIntro(avoid: SectionColorIndex[] = []): ImplicitIntro {
  return { name: "Intro", color: pickSectionColor(avoid) };
}

export function resolveSectionMarkers(doc: SongDocV2): ResolvedSectionMarker[] {
  const stored = listStoredSectionMarkers(doc.events);
  if (stored.length === 0) return [];

  const atZero = stored.find((m) => m.tick === 0);
  const out: ResolvedSectionMarker[] = [];

  if (!atZero) {
    const intro = doc.layout?.implicitIntro ?? defaultImplicitIntro([stored[0].color]);
    out.push({
      id: IMPLICIT_INTRO_MARKER_ID,
      tick: 0,
      name: intro.name,
      color: intro.color,
      implicit: true,
      placedManually: false,
    });
  }

  for (const m of stored) {
    out.push({
      id: m.id,
      tick: m.tick,
      name: m.name,
      color: m.color,
      implicit: false,
      placedManually: m.placedManually,
    });
  }

  return out.sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id));
}

/** Limpia Intro implícita si ya no hay marcadores de sección guardados. */
export function pruneImplicitIntro(doc: SongDocV2): SongDocV2 {
  if (hasStoredSectionMarkers(doc.events)) return doc;
  if (!doc.layout?.implicitIntro) return doc;
  const { implicitIntro: _removed, ...restLayout } = doc.layout;
  return { ...doc, layout: Object.keys(restLayout).length > 0 ? restLayout : undefined };
}

export function neighborSectionColors(events: TimedEvent[], tick: number): SectionColorIndex[] {
  const markers = listStoredSectionMarkers(events);
  const prev = [...markers].reverse().find((m) => m.tick < tick);
  const next = markers.find((m) => m.tick > tick);
  const avoid: SectionColorIndex[] = [];
  if (prev) avoid.push(prev.color);
  if (next) avoid.push(next.color);
  return avoid;
}
