import { nanoid } from "nanoid";
import { isSpecialToken, type SongDoc } from "@/lib/songDoc";
import {
  createDefaultTiming,
  type LayoutMarker,
  type SongDocV2,
  type TimedEvent,
  type TimedNote,
  normalizeSongDocV2,
} from "@/lib/songDocV2";

function isBreakToken(note: string): boolean {
  return note === "⏎" || note === "BR" || note === "SALTO";
}

function isSpaceToken(note: string): boolean {
  return note === "—" || note === "SPACE";
}

export function migrateV1ToV2(doc: SongDoc, tempo?: number): SongDocV2 {
  const timing = createDefaultTiming();
  if (typeof tempo === "number" && tempo > 0) timing.tempo = tempo;

  const duration = timing.ppq;
  const sectionsById: SongDocV2["sectionsById"] = {};

  for (const [id, sec] of Object.entries(doc.sectionsById)) {
    const events: TimedEvent[] = [];
    let tick = 0;

    for (const item of sec.items) {
      if (isBreakToken(item.note)) {
        const marker: LayoutMarker = {
          kind: "marker",
          id: nanoid(),
          tick,
          marker: "line-break",
        };
        events.push(marker);
      } else if (isSpaceToken(item.note)) {
        const marker: LayoutMarker = {
          kind: "marker",
          id: nanoid(),
          tick,
          marker: "space",
        };
        events.push(marker);
      } else if (isSpecialToken(item.note)) {
        continue;
      } else {
        const note: TimedNote = {
          kind: "note",
          id: item.id || nanoid(),
          note: item.note,
          start: tick,
          duration,
        };
        events.push(note);
        tick += duration;
      }
    }

    sectionsById[id] = { id, name: sec.name, events };
  }

  return normalizeSongDocV2({
    version: 2,
    timing,
    sectionsById,
    arrangement: doc.arrangement.map((inst) => ({ ...inst })),
    events: [],
  });
}

export function migrateV1ToV2Normalized(doc: SongDoc, tempo?: number): SongDocV2 {
  return normalizeSongDocV2(migrateV1ToV2(doc, tempo));
}
