import { nanoid } from "nanoid";
import type { LayoutMarker, TimedEvent } from "@/lib/songDocV2";
import { isLayoutMarker, sortEventsByTick } from "@/lib/songDocV2";
import { neighborSectionColors, pickSectionColor } from "@/lib/sectionMarkers";

export function layoutMarkerAtTick(events: TimedEvent[], tick: number): LayoutMarker | null {
  const found = events.find((e) => isLayoutMarker(e) && e.tick === tick);
  return found && isLayoutMarker(found) ? found : null;
}

export function removeLayoutMarkerAtTick(events: TimedEvent[], tick: number): TimedEvent[] {
  return events.filter((e) => !(isLayoutMarker(e) && e.tick === tick));
}

export function upsertLayoutMarker(events: TimedEvent[], marker: LayoutMarker): TimedEvent[] {
  return sortEventsByTick([...removeLayoutMarkerAtTick(events, marker.tick), marker]);
}

export function createSectionMarker(
  events: TimedEvent[],
  tick: number,
  name: string,
  placedManually: boolean
): LayoutMarker {
  return {
    kind: "marker",
    id: nanoid(),
    tick,
    marker: "section",
    name,
    color: pickSectionColor(neighborSectionColors(events, tick)),
    placedManually,
  };
}

export function createLineBreakMarker(tick: number): LayoutMarker {
  return { kind: "marker", id: nanoid(), tick, marker: "line-break" };
}

export function createSpaceMarker(tick: number): LayoutMarker {
  return { kind: "marker", id: nanoid(), tick, marker: "space" };
}
