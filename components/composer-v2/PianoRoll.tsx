"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { hasFingeringForNote } from "@/lib/fingerings";
import { displayToStored, isNoteOutOfRangeOnRoll, storedToDisplay } from "@/lib/composerV2Display";
import type { NoteLabelMode } from "@/lib/noteLabels";
import { getConflictingNoteIds, getSameCellNoteIds } from "@/lib/songConflicts";
import { defaultNoteDuration, snapTickFloor, tickToBeatLabel, ticksToSeconds } from "@/lib/songTiming";
import type { LayoutMarker, SongDocV2, TimedEvent, TimedNote } from "@/lib/songDocV2";
import { getSectionEndTick } from "@/lib/songDocV2";
import type { NoteId } from "@/lib/types";
import { isVoiceVisible, resolveVoiceIdForNewNote, voiceColor as getVoiceColor } from "@/lib/songVoices";
import PianoRollMarker from "@/components/composer-v2/PianoRollMarker";
import PianoRollNote from "@/components/composer-v2/PianoRollNote";
import type { SnapDivision } from "@/components/composer-v2/TransportBar";
import { getSnapTicks } from "@/components/composer-v2/TransportBar";
import { PIANO_ROLL_LABEL_WIDTH } from "@/lib/composerV2Layout";

const LABEL_WIDTH = PIANO_ROLL_LABEL_WIDTH;
const DEFAULT_ROW_HEIGHT = 28;
const MIN_ROW_HEIGHT = 14;
const MAX_ROW_HEIGHT = 48;
const RULER_HEIGHT = 26;
const MIN_PX_PER_TICK = 0.08;
const MAX_PX_PER_TICK = 0.5;
const DEFAULT_PX_PER_TICK = 0.15;
const DRAG_THRESHOLD_PX = 4;

type EventOrigin = {
  kind: "note" | "marker";
  start: number;
  row: number;
  note?: string;
  duration?: number;
};

type DragState =
  | { kind: "move"; startTick: number; startRow: number; origins: Map<string, EventOrigin> }
  | { kind: "resize"; noteId: string; startX: number; origDuration: number };

type DragPreview = Map<string, { start?: number; row?: number; duration?: number }>;

type PendingPointer = {
  eventId: string;
  x: number;
  y: number;
  shiftKey: boolean;
};

type PendingEmptyPointer = {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  altKey: boolean;
  noteName?: string;
};

export type TransportState = "idle" | "playing" | "paused";

type MarqueeState = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  shiftKey: boolean;
};

type PanState = {
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
};

function rectsOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number
): boolean {
  return a0 < b1 && b0 < a1;
}

export default function PianoRoll({
  notes,
  doc,
  sectionId,
  labelMode,
  transpose,
  snap,
  pxPerTick,
  rowHeight = DEFAULT_ROW_HEIGHT,
  selectedEventIds,
  onSelectionChange,
  onDocChange,
  onPreviewNote,
  scrollToTick,
  onScrollToTickHandled,
  scrollToPlayableRequest,
  onCursorTickChange,
  activeVoiceId,
  playheadTick = 0,
  transportState = "idle",
  scrollLeft,
  onViewportScroll,
}: {
  notes: string[];
  doc: SongDocV2;
  sectionId: string;
  labelMode: NoteLabelMode;
  transpose: number;
  snap: SnapDivision;
  pxPerTick: number;
  rowHeight?: number;
  selectedEventIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onDocChange: (next: SongDocV2) => void;
  onPreviewNote: (note: string, durationSec?: number) => void | Promise<void>;
  scrollToTick?: number | null;
  onScrollToTickHandled?: () => void;
  scrollToPlayableRequest?: number;
  onCursorTickChange?: (tick: number) => void;
  activeVoiceId?: string;
  playheadTick?: number;
  transportState?: TransportState;
  scrollLeft?: number;
  onViewportScroll?: (left: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedEventIds);
  selectedRef.current = selectedEventIds;
  const suppressClearRef = useRef(false);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [pendingPointer, setPendingPointer] = useState<PendingPointer | null>(null);
  const [pendingEmpty, setPendingEmpty] = useState<PendingEmptyPointer | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [playheadDragging, setPlayheadDragging] = useState(false);
  const [panning, setPanning] = useState<PanState | null>(null);
  const scrollSyncRef = useRef(false);

  const sec = doc.sectionsById[sectionId];
  const events = sec?.events ?? [];
  const snapDiv = getSnapTicks(doc, snap);
  const conflictIds = useMemo(() => getConflictingNoteIds(doc), [doc]);
  const sameCellIds = useMemo(() => getSameCellNoteIds(doc), [doc]);

  const noteIndex = useMemo(() => {
    const m = new Map<string, number>();
    notes.forEach((n, i) => m.set(n, i));
    return m;
  }, [notes]);

  const rowPlayable = useMemo(() => {
    return notes.map((noteName) => hasFingeringForNote(noteName as NoteId));
  }, [notes]);

  const contentWidth = useMemo(() => {
    const end = getSectionEndTick(events);
    const minTicks = doc.timing.ppq * 8;
    return Math.max(minTicks, end + doc.timing.ppq * 2) * pxPerTick + LABEL_WIDTH;
  }, [events, doc.timing.ppq, pxPerTick]);

  const contentHeight = RULER_HEIGHT + notes.length * rowHeight;

  const soundingNoteIds = useMemo(() => {
    if (transportState !== "playing") return new Set<string>();
    const ids = new Set<string>();
    for (const ev of events) {
      if (ev.kind !== "note") continue;
      if (!isVoiceVisible(doc, ev.voiceId)) continue;
      if (ev.start <= playheadTick && playheadTick < ev.start + ev.duration) {
        ids.add(ev.id);
      }
    }
    return ids;
  }, [events, playheadTick, transportState, doc]);

  const playheadColor =
    transportState === "playing"
      ? "rgba(120, 220, 255, 0.95)"
      : transportState === "paused"
      ? "rgba(255, 200, 80, 0.95)"
      : "rgba(255, 255, 255, 0.85)";

  const gridLines = useMemo(() => {
    const ppq = doc.timing.ppq;
    const endTick = Math.max(ppq * 8, getSectionEndTick(events) + ppq * 2);
    const step = snap === "free" ? ppq : snap === "quarter" ? ppq : snapDiv;
    const lines: Array<{ tick: number; strength: "bar" | "quarter" | "sub" }> = [];
    for (let tick = 0; tick <= endTick; tick += step) {
      if (tick % (ppq * 4) === 0) lines.push({ tick, strength: "bar" });
      else if (tick % ppq === 0) lines.push({ tick, strength: "quarter" });
      else if (snap !== "quarter" && snap !== "free") lines.push({ tick, strength: "sub" });
    }
    return lines;
  }, [doc.timing.ppq, events, snap, snapDiv]);

  const centerPlayableRows = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let first = -1;
    let last = -1;
    rowPlayable.forEach((playable, i) => {
      if (!playable) return;
      if (first < 0) first = i;
      last = i;
    });
    if (first < 0) return;
    const top = RULER_HEIGHT + first * rowHeight;
    const blockHeight = (last - first + 1) * rowHeight;
    const ideal = top - (vp.clientHeight - blockHeight) / 2;
    const maxScroll = Math.max(0, contentHeight - vp.clientHeight);
    vp.scrollTop = Math.max(0, Math.min(ideal, maxScroll));
  }, [rowPlayable, contentHeight, rowHeight]);

  const centerPlayableRowsRef = useRef(centerPlayableRows);
  centerPlayableRowsRef.current = centerPlayableRows;

  useEffect(() => {
    if (scrollToTick == null || !viewportRef.current) return;
    const x = scrollToTick * pxPerTick;
    const left = Math.max(0, x - 80);
    viewportRef.current.scrollLeft = left;
    onViewportScroll?.(left);
    onScrollToTickHandled?.();
  }, [scrollToTick, pxPerTick, onScrollToTickHandled, onViewportScroll]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (vp == null || scrollLeft == null || scrollSyncRef.current) return;
    if (Math.abs(vp.scrollLeft - scrollLeft) < 1) return;
    scrollSyncRef.current = true;
    vp.scrollLeft = scrollLeft;
    requestAnimationFrame(() => {
      scrollSyncRef.current = false;
    });
  }, [scrollLeft]);

  useEffect(() => {
    if (transportState !== "playing") return;
    const vp = viewportRef.current;
    if (!vp) return;
    const x = LABEL_WIDTH + playheadTick * pxPerTick;
    const margin = 96;
    let left = vp.scrollLeft;
    if (x < vp.scrollLeft + margin) {
      left = Math.max(0, x - margin);
    } else if (x > vp.scrollLeft + vp.clientWidth - margin) {
      left = Math.max(0, x - vp.clientWidth + margin);
    }
    if (left !== vp.scrollLeft) {
      vp.scrollLeft = left;
      onViewportScroll?.(left);
    }
  }, [playheadTick, transportState, pxPerTick, onViewportScroll]);

  function setPlayheadFromClientX(clientX: number) {
    const tick = tickFromClientX(clientX);
    onCursorTickChange?.(tick);
  }

  function handlePlayheadPointerDown(e: React.MouseEvent) {
    if (transportState === "playing") return;
    e.stopPropagation();
    e.preventDefault();
    suppressClearRef.current = true;
    setPlayheadDragging(true);
    setPlayheadFromClientX(e.clientX);
  }

  function handleRulerPointerDown(e: React.MouseEvent) {
    if (transportState === "playing") return;
    e.stopPropagation();
    suppressClearRef.current = true;
    setPlayheadDragging(true);
    setPlayheadFromClientX(e.clientX);
  }

  useEffect(() => {
    if (!scrollToPlayableRequest) return;
    centerPlayableRowsRef.current();
  }, [scrollToPlayableRequest]);

  function patchEvents(mut: (events: TimedEvent[]) => TimedEvent[]) {
    if (!sec) return;
    const next: SongDocV2 = {
      ...doc,
      timing: { ...doc.timing },
      sectionsById: structuredClone(doc.sectionsById),
      arrangement: doc.arrangement.map((x) => ({ ...x })),
    };
    next.sectionsById[sectionId] = {
      ...next.sectionsById[sectionId],
      events: mut([...next.sectionsById[sectionId].events]),
    };
    onDocChange(next);
  }

  const rawTickFromClientX = useCallback(
    (clientX: number) => {
      const vp = viewportRef.current;
      if (!vp) return 0;
      const rect = vp.getBoundingClientRect();
      const x = clientX - rect.left + vp.scrollLeft - LABEL_WIDTH;
      return Math.max(0, x / pxPerTick);
    },
    [pxPerTick]
  );

  const tickFromClientX = useCallback(
    (clientX: number) => {
      return snapTickFloor(rawTickFromClientX(clientX), snapDiv);
    },
    [rawTickFromClientX, snapDiv]
  );

  useEffect(() => {
    if (!playheadDragging) return;
    const onMove = (e: MouseEvent) => {
      const tick = tickFromClientX(e.clientX);
      onCursorTickChange?.(tick);
    };
    const onUp = () => {
      setPlayheadDragging(false);
      window.setTimeout(() => {
        suppressClearRef.current = false;
      }, 0);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [playheadDragging, tickFromClientX, onCursorTickChange]);

  const rowFromClientY = useCallback(
    (clientY: number) => {
      const vp = viewportRef.current;
      if (!vp) return 0;
      const rect = vp.getBoundingClientRect();
      const y = clientY - rect.top + vp.scrollTop - RULER_HEIGHT;
      return Math.max(0, Math.min(notes.length - 1, Math.floor(y / rowHeight)));
    },
    [notes.length, rowHeight]
  );

  const clientToContent = useCallback((clientX: number, clientY: number) => {
    const vp = viewportRef.current;
    if (!vp) return { x: 0, y: 0 };
    const rect = vp.getBoundingClientRect();
    return {
      x: clientX - rect.left + vp.scrollLeft,
      y: clientY - rect.top + vp.scrollTop,
    };
  }, []);

  function displayNoteToRow(displayNote: string): number | null {
    return noteIndex.get(displayNote) ?? null;
  }

  function rowToStoredNote(row: number): string {
    const base = notes[row];
    if (!base) return notes[0] ?? "C4";
    return displayToStored(base, transpose);
  }

  function getEventOrigin(ev: TimedEvent): EventOrigin | null {
    if (ev.kind === "marker") {
      return { kind: "marker", start: ev.tick, row: 0 };
    }
    const displayNote = storedToDisplay(ev.note, transpose);
    const row = displayNoteToRow(displayNote);
    if (row == null) return null;
    return { kind: "note", start: ev.start, row, note: ev.note, duration: ev.duration };
  }

  function applySelection(eventId: string, shiftKey: boolean) {
    const cur = selectedRef.current;
    if (shiftKey) {
      const next = new Set(cur);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      onSelectionChange(next);
      return;
    }
    onSelectionChange(new Set([eventId]));
  }

  function playNoteEvent(note: TimedNote) {
    const displayNote = storedToDisplay(note.note, transpose);
    const dur = ticksToSeconds(note.duration, doc.timing);
    void onPreviewNote(displayNote, Math.max(0.05, dur));
  }

  function beginMoveDrag(eventId: string, clientX: number, clientY: number) {
    const cur = selectedRef.current;
    const ids = cur.has(eventId) && cur.size > 0 ? Array.from(cur) : [eventId];

    const origins = new Map<string, EventOrigin>();
    for (const id of ids) {
      const ev = events.find((e) => e.id === id);
      if (!ev) continue;
      const origin = getEventOrigin(ev);
      if (origin) origins.set(id, origin);
    }
    if (origins.size === 0) return;

    if (!cur.has(eventId)) {
      onSelectionChange(new Set(ids));
    }

    setDrag({
      kind: "move",
      startTick: tickFromClientX(clientX),
      startRow: rowFromClientY(clientY),
      origins,
    });
    setDragPreview(new Map());
  }

  function selectEventsInMarquee(state: MarqueeState): Set<string> {
    const left = Math.min(state.x0, state.x1);
    const right = Math.max(state.x0, state.x1);
    const top = Math.min(state.y0, state.y1);
    const bottom = Math.max(state.y0, state.y1);

    const tickMin = Math.max(0, (left - LABEL_WIDTH) / pxPerTick);
    const tickMax = (right - LABEL_WIDTH) / pxPerTick;
    const rowMin = Math.max(0, Math.floor((top - RULER_HEIGHT) / rowHeight));
    const rowMax = Math.min(
      notes.length - 1,
      Math.floor((Math.max(top, bottom - 1) - RULER_HEIGHT) / rowHeight)
    );

    const ids = new Set<string>();
    for (const ev of events) {
      if (ev.kind === "marker") {
        if (ev.tick >= tickMin && ev.tick <= tickMax) ids.add(ev.id);
        continue;
      }
      if (!isVoiceVisible(doc, ev.voiceId)) continue;
      const displayNote = storedToDisplay(ev.note, transpose);
      const row = displayNoteToRow(displayNote);
      if (row == null) continue;
      if (row < rowMin || row > rowMax) continue;
      const noteEnd = ev.start + ev.duration;
      if (rectsOverlap(ev.start, noteEnd, tickMin, tickMax)) ids.add(ev.id);
    }
    return ids;
  }

  function placeNoteAt(noteName: string, clientX: number) {
    const tick = tickFromClientX(clientX);
    onCursorTickChange?.(tick);
    const storedNote = displayToStored(noteName, transpose);
    const dur = defaultNoteDuration(doc.timing);
    const newNote: TimedNote = {
      kind: "note",
      id: nanoid(),
      note: storedNote,
      start: tick,
      duration: dur,
      voiceId: resolveVoiceIdForNewNote(doc, activeVoiceId),
    };
    patchEvents((evs) => [...evs, newNote]);
    onSelectionChange(new Set([newNote.id]));
    void onPreviewNote(noteName, ticksToSeconds(dur, doc.timing));
  }

  function beginMarquee(clientX: number, clientY: number, shiftKey: boolean) {
    const { x, y } = clientToContent(clientX, clientY);
    setMarquee({ x0: x, y0: y, x1: x, y1: y, shiftKey });
  }

  function handleEmptyPointerDown(e: React.MouseEvent, noteName?: string) {
    if (e.button === 2) return;
    if (suppressClearRef.current) return;
    if ((e.target as HTMLElement).closest("[data-roll-note]")) return;
    if ((e.target as HTMLElement).closest("[data-roll-marker]")) return;
    if ((e.target as HTMLElement).closest("button")) return;
    if (pendingPointer || pendingEmpty || drag || marquee) return;
    e.stopPropagation();
    suppressClearRef.current = true;
    setPendingEmpty({
      clientX: e.clientX,
      clientY: e.clientY,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      noteName,
    });
  }

  function handleEventPointerDown(eventId: string, e: React.MouseEvent) {
    e.stopPropagation();
    suppressClearRef.current = true;
    setPendingPointer({ eventId, x: e.clientX, y: e.clientY, shiftKey: e.shiftKey });
  }

  function handleBackgroundPointerDown(e: React.MouseEvent) {
    if (e.button === 2) return;
    handleEmptyPointerDown(e);
  }

  function handleViewportPanStart(e: React.MouseEvent) {
    if (e.button !== 2 || !viewportRef.current) return;
    e.preventDefault();
    suppressClearRef.current = true;
    setPanning({
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    });
  }

  function buildPreviewFromDrag(clientX: number, clientY: number, state: Extract<DragState, { kind: "move" }>): DragPreview {
    const tick = tickFromClientX(clientX);
    const row = rowFromClientY(clientY);
    const deltaTick = tick - state.startTick;
    const deltaRow = row - state.startRow;
    const preview = new Map<string, { start?: number; row?: number; duration?: number }>();

    for (const [id, origin] of state.origins) {
      const newStart = Math.max(0, snapTickFloor(origin.start + deltaTick, snapDiv));
      if (origin.kind === "marker") {
        preview.set(id, { start: newStart, row: origin.row });
      } else {
        const newRow = Math.max(0, Math.min(notes.length - 1, origin.row + deltaRow));
        preview.set(id, { start: newStart, row: newRow });
      }
    }
    return preview;
  }

  function commitMoveDrag(clientX: number, clientY: number, state: Extract<DragState, { kind: "move" }>) {
    const tick = tickFromClientX(clientX);
    const row = rowFromClientY(clientY);
    const deltaTick = tick - state.startTick;
    const deltaRow = row - state.startRow;

    patchEvents((evs) =>
      evs.map((ev) => {
        const origin = state.origins.get(ev.id);
        if (!origin) return ev;
        const newStart = Math.max(0, snapTickFloor(origin.start + deltaTick, snapDiv));
        if (origin.kind === "marker" && ev.kind === "marker") {
          return { ...ev, tick: newStart };
        }
        if (origin.kind === "note" && ev.kind === "note") {
          const newRow = Math.max(0, Math.min(notes.length - 1, origin.row + deltaRow));
          const newNote = rowToStoredNote(newRow);
          return { ...ev, start: newStart, note: newNote };
        }
        return ev;
      })
    );
  }

  useEffect(() => {
    if (!pendingPointer && !pendingEmpty && !drag && !marquee) return;

    const onMove = (e: MouseEvent) => {
      if (pendingEmpty && !marquee && !drag) {
        const dx = e.clientX - pendingEmpty.clientX;
        const dy = e.clientY - pendingEmpty.clientY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
          beginMarquee(pendingEmpty.clientX, pendingEmpty.clientY, pendingEmpty.shiftKey);
          setPendingEmpty(null);
          const { x, y } = clientToContent(e.clientX, e.clientY);
          setMarquee((m) => (m ? { ...m, x1: x, y1: y } : m));
        }
        return;
      }

      if (marquee && !drag) {
        const { x, y } = clientToContent(e.clientX, e.clientY);
        setMarquee((m) => (m ? { ...m, x1: x, y1: y } : m));
        return;
      }

      if (pendingPointer && !drag) {
        const dx = e.clientX - pendingPointer.x;
        const dy = e.clientY - pendingPointer.y;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
          beginMoveDrag(pendingPointer.eventId, e.clientX, e.clientY);
          setPendingPointer(null);
        }
        return;
      }
      if (!drag) return;

      if (drag.kind === "move") {
        setDragPreview(buildPreviewFromDrag(e.clientX, e.clientY, drag));
      } else if (drag.kind === "resize") {
        const note = events.find((ev) => ev.kind === "note" && ev.id === drag.noteId) as TimedNote | undefined;
        if (!note) return;
        const rawEnd = rawTickFromClientX(e.clientX);
        const endTick = snapTickFloor(rawEnd, snapDiv);
        const newDur = Math.max(snapDiv, endTick - note.start);
        setDragPreview(new Map([[drag.noteId, { duration: newDur }]]));
      }
    };

    const onUp = (e: MouseEvent) => {
      if (pendingEmpty && !marquee && !drag) {
        const { noteName, shiftKey, altKey, clientX } = pendingEmpty;
        if (noteName && altKey) {
          setPlayheadFromClientX(clientX);
        } else if (noteName) {
          placeNoteAt(noteName, clientX);
        } else if (!shiftKey) {
          onSelectionChange(new Set());
        }
        setPendingEmpty(null);
        window.setTimeout(() => {
          suppressClearRef.current = false;
        }, 0);
        return;
      }

      if (marquee && !drag) {
        const ids = selectEventsInMarquee(marquee);
        if (marquee.shiftKey) {
          const next = new Set(selectedRef.current);
          for (const id of ids) next.add(id);
          onSelectionChange(next);
        } else {
          onSelectionChange(ids);
        }
        setMarquee(null);
        window.setTimeout(() => {
          suppressClearRef.current = false;
        }, 0);
        return;
      }

      if (pendingPointer && !drag) {
        const { eventId, shiftKey } = pendingPointer;
        const ev = events.find((x) => x.id === eventId);
        applySelection(eventId, shiftKey);
        if (ev?.kind === "note") playNoteEvent(ev);
        setPendingPointer(null);
        window.setTimeout(() => {
          suppressClearRef.current = false;
        }, 0);
        return;
      }

      if (!drag) return;

      if (drag.kind === "move") {
        commitMoveDrag(e.clientX, e.clientY, drag);
      } else if (drag.kind === "resize") {
        const note = events.find((ev) => ev.kind === "note" && ev.id === drag.noteId) as TimedNote | undefined;
        if (note) {
          const rawEnd = rawTickFromClientX(e.clientX);
          const endTick = snapTickFloor(rawEnd, snapDiv);
          const newDur = Math.max(snapDiv, endTick - note.start);
          patchEvents((evs) =>
            evs.map((ev) => {
              if (ev.kind !== "note" || ev.id !== drag.noteId) return ev;
              return { ...ev, duration: newDur };
            })
          );
        }
      }
      setDragPreview(null);
      setDrag(null);
      setPendingPointer(null);
      window.setTimeout(() => {
        suppressClearRef.current = false;
      }, 0);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPointer, pendingEmpty, drag, marquee, tickFromClientX, rawTickFromClientX, rowFromClientY, clientToContent, snapDiv, events, notes, pxPerTick, transpose]);

  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const left = Math.max(0, panning.scrollLeft - (e.clientX - panning.startX));
      const top = Math.max(0, panning.scrollTop - (e.clientY - panning.startY));
      vp.scrollLeft = left;
      vp.scrollTop = top;
      onViewportScroll?.(left);
    };
    const onUp = () => {
      setPanning(null);
      window.setTimeout(() => {
        suppressClearRef.current = false;
      }, 0);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [panning, onViewportScroll]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const blockWheel = (e: WheelEvent) => e.preventDefault();
    vp.addEventListener("wheel", blockWheel, { passive: false });
    return () => vp.removeEventListener("wheel", blockWheel);
  }, []);

  function handleLabelClick(e: React.MouseEvent, noteName: string) {
    e.stopPropagation();
    void onPreviewNote(noteName);
  }

  const rowBgPlayable = "rgba(48, 88, 62, 0.22)";
  const rowBgUnplayable = "rgba(0, 0, 0, 0.18)";
  const labelBgPlayable = "rgba(40, 72, 52, 0.55)";
  const labelBgUnplayable = "rgba(0, 0, 0, 0.35)";

  function gridLineColor(strength: "bar" | "quarter" | "sub") {
    if (strength === "bar") return "rgba(255,255,255,0.16)";
    if (strength === "quarter") return "rgba(255,255,255,0.10)";
    return "rgba(255,255,255,0.04)";
  }

  return (
    <div
      ref={viewportRef}
      className="composer-v2-pan-viewport"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.25)",
        maxHeight: 420,
        position: "relative",
        cursor: panning ? "grabbing" : "default",
      }}
      onMouseDown={(e) => {
        handleViewportPanStart(e);
        if (e.button !== 2) handleBackgroundPointerDown(e);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={{ width: contentWidth, height: contentHeight, position: "relative" }}>
        {marquee ? (
          <div
            style={{
              position: "absolute",
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
              border: "1px solid rgba(120, 200, 255, 0.95)",
              background: "rgba(120, 200, 255, 0.12)",
              pointerEvents: "none",
              zIndex: 25,
            }}
          />
        ) : null}
        {gridLines.map((line) => (
          <div
            key={`grid-${line.tick}-${line.strength}`}
            style={{
              position: "absolute",
              left: LABEL_WIDTH + line.tick * pxPerTick,
              top: RULER_HEIGHT,
              bottom: 0,
              width: 1,
              background: gridLineColor(line.strength),
              pointerEvents: "none",
            }}
          />
        ))}

        <div
          data-roll-ruler="1"
          onMouseDown={handleRulerPointerDown}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: RULER_HEIGHT,
            zIndex: 15,
            cursor: transportState === "playing" ? "default" : "ew-resize",
            background: "rgba(0,0,0,0.45)",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div
            style={{
              position: "sticky",
              left: 0,
              width: LABEL_WIDTH,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 800,
              opacity: 0.55,
              background: "rgba(0,0,0,0.5)",
              zIndex: 2,
            }}
          >
            ⏱
          </div>
          {gridLines
            .filter((line) => line.strength === "bar" || line.strength === "quarter")
            .map((line) => (
              <div
                key={`ruler-${line.tick}`}
                style={{
                  position: "absolute",
                  left: LABEL_WIDTH + line.tick * pxPerTick,
                  top: 0,
                  height: "100%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  alignItems: "flex-end",
                  paddingBottom: 3,
                  pointerEvents: "none",
                }}
              >
                <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 700 }}>
                  {tickToBeatLabel(line.tick, doc.timing)}
                </span>
              </div>
            ))}
        </div>

        <div
          data-roll-playhead="1"
          onMouseDown={handlePlayheadPointerDown}
          style={{
            position: "absolute",
            left: LABEL_WIDTH + playheadTick * pxPerTick,
            top: 0,
            width: 2,
            height: contentHeight,
            background: playheadColor,
            boxShadow: `0 0 8px ${playheadColor}`,
            zIndex: 20,
            cursor: transportState === "playing" ? "default" : "ew-resize",
            pointerEvents: transportState === "playing" ? "none" : "auto",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 2,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `10px solid ${playheadColor}`,
            }}
          />
        </div>

        {notes.map((noteName, rowIdx) => {
          const playable = rowPlayable[rowIdx];
          const displayNote = noteName;
          return (
            <div
              key={noteName}
              style={{
                position: "absolute",
                top: RULER_HEIGHT + rowIdx * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
                display: "flex",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleLabelClick(e, noteName)}
                style={{
                  width: LABEL_WIDTH,
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  color: playable ? "rgba(220, 255, 230, 0.9)" : "rgba(255,255,255,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: playable ? labelBgPlayable : labelBgUnplayable,
                  position: "sticky",
                  left: 0,
                  zIndex: 5,
                  border: "none",
                  cursor: playable ? "pointer" : "default",
                  padding: 0,
                }}
                title={playable ? `Escuchar ${displayNote.replace("#", "♯")}` : "Sin digitación en ocarina"}
              >
                {displayNote.replace("#", "♯")}
              </button>
              <div
                data-roll-grid="1"
                style={{
                  flex: 1,
                  position: "relative",
                  cursor: "crosshair",
                  background: playable ? rowBgPlayable : rowBgUnplayable,
                }}
                onMouseDown={(e) => handleEmptyPointerDown(e, noteName)}
              />
            </div>
          );
        })}

        {events
          .filter((e): e is LayoutMarker => e.kind === "marker")
          .map((m) => {
            const preview = dragPreview?.get(m.id);
            const tick = preview?.start ?? m.tick;
            return (
              <div
                key={m.id}
                data-roll-marker="1"
                style={{ position: "absolute", top: RULER_HEIGHT, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <PianoRollMarker
                  marker={m}
                  left={LABEL_WIDTH + tick * pxPerTick}
                  height={contentHeight - RULER_HEIGHT}
                  selected={selectedEventIds.has(m.id)}
                  onPointerDown={(e) => handleEventPointerDown(m.id, e)}
                />
              </div>
            );
          })}

        {events
          .filter((e): e is TimedNote => e.kind === "note")
          .filter((note) => isVoiceVisible(doc, note.voiceId))
          .map((note) => {
            const displayNote = storedToDisplay(note.note, transpose);
            const baseRow = displayNoteToRow(displayNote);
            if (baseRow == null) return null;
            const invalid = isNoteOutOfRangeOnRoll(note.note, transpose, notes);
            const preview = dragPreview?.get(note.id);
            const row = preview?.row ?? baseRow;
            const start = preview?.start ?? note.start;
            const duration = preview?.duration ?? note.duration;
            const noteVoiceColor = getVoiceColor(doc, note.voiceId);
            return (
              <div
                key={note.id}
                data-roll-note="1"
                style={{ pointerEvents: "auto" }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <PianoRollNote
                  note={{ ...note, note: displayNote, start, duration }}
                  top={RULER_HEIGHT + row * rowHeight}
                  left={LABEL_WIDTH + start * pxPerTick}
                  width={duration * pxPerTick}
                  rowHeight={rowHeight}
                  selected={selectedEventIds.has(note.id)}
                  invalid={invalid}
                  conflict={conflictIds.has(note.id) && !sameCellIds.has(note.id)}
                  sameCell={sameCellIds.has(note.id)}
                  sounding={soundingNoteIds.has(note.id)}
                  voiceColor={noteVoiceColor}
                  labelMode={labelMode}
                  onPointerDown={(e) => handleEventPointerDown(note.id, e)}
                  onResizeStart={(e) => {
                    e.stopPropagation();
                    suppressClearRef.current = true;
                    const t = tickFromClientX(e.clientX);
                    const cur = selectedRef.current;
                    if (!cur.has(note.id)) onSelectionChange(new Set([note.id]));
                    setPendingPointer(null);
                    setDrag({ kind: "resize", noteId: note.id, startX: t, origDuration: note.duration });
                    setDragPreview(new Map([[note.id, { duration: note.duration }]]));
                  }}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}

export {
  DEFAULT_PX_PER_TICK,
  MIN_PX_PER_TICK,
  MAX_PX_PER_TICK,
  DEFAULT_ROW_HEIGHT,
  MIN_ROW_HEIGHT,
  MAX_ROW_HEIGHT,
};
