import { displayToStored, storedToDisplay } from "@/lib/composerV2Display";
import { snapTickFloor } from "@/lib/songTiming";
import {
  duplicateEventsWithNewIds,
  sortEventsByTick,
  tickOf,
  type TimedEvent,
} from "@/lib/songDocV2";

export type TimelineClipboardData = {
  version: 1;
  events: TimedEvent[];
  anchorTick: number;
};

const CLIPBOARD_KEY = "ocarinaTimelineV2";

function eventEndTick(ev: TimedEvent): number {
  if (ev.kind === "note") return ev.start + ev.duration;
  return ev.tick;
}

function selectedEventsInOrder(events: TimedEvent[], selectedIds: Set<string>): TimedEvent[] {
  return sortEventsByTick(events.filter((e) => selectedIds.has(e.id)));
}

export function buildTimelineClipboardPayload(
  events: TimedEvent[],
  selectedIds: Set<string>
): string | null {
  const picked = selectedEventsInOrder(events, selectedIds);
  if (picked.length === 0) return null;

  const anchorTick = Math.min(...picked.map(tickOf));
  const stripped: TimedEvent[] = picked.map((ev) => {
    if (ev.kind === "note") {
      return {
        kind: "note",
        id: "",
        note: ev.note,
        start: ev.start,
        duration: ev.duration,
        ...(ev.voiceId ? { voiceId: ev.voiceId } : {}),
      };
    }
    return { kind: "marker", id: "", tick: ev.tick, marker: ev.marker };
  });

  const payload = {
    [CLIPBOARD_KEY]: {
      version: 1 as const,
      events: stripped,
      anchorTick,
    },
  };
  return JSON.stringify(payload);
}

export function parseTimelineClipboardPayload(text: string): TimelineClipboardData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const block = (parsed as Record<string, unknown>)[CLIPBOARD_KEY];
  if (!block || typeof block !== "object") return null;
  const data = block as Record<string, unknown>;
  if (data.version !== 1) return null;
  if (!Array.isArray(data.events) || data.events.length === 0) return null;
  if (typeof data.anchorTick !== "number") return null;

  const events: TimedEvent[] = [];
  for (const raw of data.events) {
    if (!raw || typeof raw !== "object") return null;
    const ev = raw as Record<string, unknown>;
    if (ev.kind === "note") {
      if (typeof ev.note !== "string" || typeof ev.start !== "number" || typeof ev.duration !== "number") return null;
      events.push({
        kind: "note",
        id: "",
        note: ev.note,
        start: ev.start,
        duration: ev.duration,
        ...(typeof ev.voiceId === "string" ? { voiceId: ev.voiceId } : {}),
      });
    } else if (ev.kind === "marker" && ev.marker === "line-break") {
      if (typeof ev.tick !== "number") return null;
      events.push({ kind: "marker", id: "", tick: ev.tick, marker: "line-break" });
    } else {
      return null;
    }
  }

  return { version: 1, events, anchorTick: data.anchorTick };
}

export function offsetEventsForPaste(
  events: TimedEvent[],
  anchorTick: number,
  targetTick: number,
  snapDiv: number
): TimedEvent[] {
  const alignedTarget = snapTickFloor(targetTick, snapDiv);
  const delta = alignedTarget - anchorTick;

  return duplicateEventsWithNewIds(events).map((ev) => {
    const base = tickOf(ev);
    const nextTick = Math.max(0, snapTickFloor(base + delta, snapDiv));
    if (ev.kind === "note") {
      return { ...ev, start: nextTick };
    }
    return { ...ev, tick: nextTick };
  });
}

export function computeDuplicatePasteTick(
  events: TimedEvent[],
  selectedIds: Set<string>,
  snapDiv: number
): number {
  const picked = selectedEventsInOrder(events, selectedIds);
  if (picked.length === 0) return 0;
  const maxEnd = Math.max(...picked.map(eventEndTick));
  return snapTickFloor(maxEnd + snapDiv, snapDiv);
}

function rowForStoredNote(note: string, rollNotes: string[], transpose: number): number | null {
  const display = storedToDisplay(note, transpose);
  const idx = rollNotes.indexOf(display);
  return idx >= 0 ? idx : null;
}

function storedNoteForRow(row: number, rollNotes: string[], transpose: number): string {
  const base = rollNotes[row];
  if (!base) return rollNotes[0] ?? "C4";
  return displayToStored(base, transpose);
}

export function nudgeSelectedEvents(
  events: TimedEvent[],
  selectedIds: Set<string>,
  deltaTick: number,
  deltaRow: number,
  rollNotes: string[],
  transpose: number
): TimedEvent[] {
  if (selectedIds.size === 0 || (deltaTick === 0 && deltaRow === 0)) return events;

  return events.map((ev) => {
    if (!selectedIds.has(ev.id)) return ev;

    if (ev.kind === "marker") {
      const nextTick = Math.max(0, ev.tick + deltaTick);
      return { ...ev, tick: nextTick };
    }

    const row = rowForStoredNote(ev.note, rollNotes, transpose);
    let nextNote = ev.note;
    if (row != null && deltaRow !== 0) {
      const nextRow = Math.max(0, Math.min(rollNotes.length - 1, row + deltaRow));
      nextNote = storedNoteForRow(nextRow, rollNotes, transpose);
    }
    const nextStart = Math.max(0, ev.start + deltaTick);
    return { ...ev, start: nextStart, note: nextNote };
  });
}

export function firstEventTick(events: TimedEvent[]): number {
  if (events.length === 0) return 0;
  return Math.min(...events.map(tickOf));
}
