import { nanoid } from "nanoid";
import { createSectionMarker } from "@/lib/layoutMarkers";
import type { SongDocV2, TimedEvent } from "@/lib/songDocV2";
import { createDefaultTiming, getSectionEndTick, sortEventsByTick } from "@/lib/songDocV2";

function shiftEvents(events: TimedEvent[], offset: number): TimedEvent[] {
  return events.map((ev) => {
    if (ev.kind === "note") return { ...ev, start: ev.start + offset };
    return { ...ev, tick: ev.tick + offset };
  });
}

function migrateLegacyArrangement(doc: SongDocV2): TimedEvent[] {
  const arrangement = doc.arrangement ?? [];
  const sectionsById = doc.sectionsById ?? {};
  if (arrangement.length === 0) {
    const first = Object.values(sectionsById)[0];
    return first ? [...first.events] : [];
  }

  const events: TimedEvent[] = [];
  let offset = 0;

  for (let i = 0; i < arrangement.length; i++) {
    const sec = sectionsById[arrangement[i].sectionId];
    if (!sec) continue;

    if (arrangement.length > 1) {
      const marker = createSectionMarker(events, offset, sec.name, false);
      events.push(marker);
    }

    events.push(...shiftEvents(sec.events, offset));
    offset = getSectionEndTick(events);
  }

  return sortEventsByTick(events);
}

/** Convierte docs v2 legacy (sectionsById + arrangement) al timeline único. */
export function normalizeSongDocV2(doc: SongDocV2): SongDocV2 {
  const hasLegacy =
    (doc.arrangement?.length ?? 0) > 0 || Object.keys(doc.sectionsById ?? {}).length > 0;

  if (hasLegacy) {
    const events = migrateLegacyArrangement(doc);
    const { sectionsById: _s, arrangement: _a, ...rest } = doc;
    return { ...rest, events };
  }

  if (Array.isArray(doc.events)) {
    const { sectionsById: _s, arrangement: _a, ...rest } = doc;
    return rest as SongDocV2;
  }

  const events = migrateLegacyArrangement(doc);
  const { sectionsById: _s, arrangement: _a, ...rest } = doc;
  return { ...rest, events };
}

export function ensureSongDocV2(raw: unknown): SongDocV2 {
  if (!raw || typeof raw !== "object") return createEmptySongDocV2Normalized();
  return normalizeSongDocV2(raw as SongDocV2);
}

export function createEmptySongDocV2Normalized(): SongDocV2 {
  return {
    version: 2,
    timing: createDefaultTiming(),
    events: [],
  };
}
