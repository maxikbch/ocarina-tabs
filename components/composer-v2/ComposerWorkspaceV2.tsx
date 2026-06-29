"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import PianoKeyboard from "@/components/PianoKeyboard";
import ConflictBanner from "@/components/composer-v2/ConflictBanner";
import PianoRoll, {
  DEFAULT_PX_PER_TICK,
  DEFAULT_ROW_HEIGHT,
  MAX_PX_PER_TICK,
  MAX_ROW_HEIGHT,
  MIN_PX_PER_TICK,
  MIN_ROW_HEIGHT,
} from "@/components/composer-v2/PianoRoll";
import SectionStrip from "@/components/composer-v2/SectionStrip";
import VoiceStrip from "@/components/composer-v2/VoiceStrip";
import TransportBar, { getSnapTicks, type SnapDivision } from "@/components/composer-v2/TransportBar";
import TimelineBar from "@/components/composer-v2/TimelineBar";
import ConfirmModal from "@/components/ConfirmModal";
import {
  buildTimelineClipboardPayload,
  computeDuplicatePasteTick,
  firstEventTick,
  nudgeSelectedEvents,
  offsetEventsForPaste,
  parseTimelineClipboardPayload,
} from "@/lib/composerV2Clipboard";
import { analyzePlayability } from "@/lib/songConflicts";
import type { ConflictJumpTarget } from "@/components/composer-v2/ConflictBanner";
import { displayToStored, effectiveTranspose, findOutOfRangeNotesForCompose, storedToDisplay } from "@/lib/composerV2Display";
import { hasFingeringForNote } from "@/lib/fingerings";
import { buildPianoRollNotes } from "@/lib/notes";
import type { NoteLabelMode } from "@/lib/noteLabels";
import { defaultNoteDuration } from "@/lib/songTiming";
import type { LayoutMarker, SongDocV2, TimedEvent, TimedNote } from "@/lib/songDocV2";
import { useTimedPlayback } from "@/lib/useTimedPlayback";
import type { NoteId } from "@/lib/types";
import { COMPOSER_V2_KEY_BINDINGS, matchesAnyKeyBinding, matchesKeyBinding } from "@/lib/config";
import { getDefaultActiveVoiceId, hasVoiceLayers, resolveVoiceIdForNewNote } from "@/lib/songVoices";
import {
  buildConsolidateConfirmMessage,
  consolidateVisibleVoices,
  previewConsolidate,
} from "@/lib/voiceConsolidate";

export default function ComposerWorkspaceV2({
  notes,
  labelMode,
  doc,
  onDocChange,
  transpose,
  onTransposeDec,
  onTransposeInc,
  onPreviewNote,
  stickyTopOffset = 12,
  onRenameSection,
}: {
  notes: string[];
  labelMode: NoteLabelMode;
  doc: SongDocV2;
  onDocChange: (next: SongDocV2) => void;
  transpose: number;
  onTransposeDec: () => void;
  onTransposeInc: () => void;
  onPreviewNote: (note: string, durationSec?: number) => void | Promise<void>;
  stickyTopOffset?: number;
  onRenameSection: (sectionId: string, currentName: string) => void;
}) {
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(doc.arrangement[0]?.id ?? null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(() => new Set());
  const [snap, setSnap] = useState<SnapDivision>("quarter");
  const [pxPerTick, setPxPerTick] = useState(DEFAULT_PX_PER_TICK);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const [transposeEnabled, setTransposeEnabled] = useState(true);
  const [hScrollLeft, setHScrollLeft] = useState(0);
  const [cursorTick, setCursorTick] = useState(0);
  const [scrollToTick, setScrollToTick] = useState<number | null>(null);
  const [scrollToPlayableRequest, setScrollToPlayableRequest] = useState(1);
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);
  const clipboardToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | undefined>(() => getDefaultActiveVoiceId(doc));
  const [consolidateOpen, setConsolidateOpen] = useState(false);

  const { playing, paused, playSectionFrom, pause, stopAndReset, previewNote } = useTimedPlayback({
    onPlayheadTick: setCursorTick,
  });

  const transportState = playing ? "playing" : paused ? "paused" : "idle";

  const displayTranspose = effectiveTranspose(transposeEnabled, transpose);

  const activeInst = doc.arrangement.find((i) => i.id === activeInstanceId);
  const activeSectionId = activeInst?.sectionId ?? null;

  useEffect(() => {
    if (!doc.arrangement.some((i) => i.id === activeInstanceId)) {
      setActiveInstanceId(doc.arrangement[0]?.id ?? null);
    }
  }, [doc.arrangement, activeInstanceId]);

  useEffect(() => {
    setSelectedEventIds(new Set());
    stopAndReset();
    setCursorTick(0);
    setHScrollLeft(0);
  }, [activeSectionId, stopAndReset]);

  useEffect(() => {
    if (!doc.voices) {
      setActiveVoiceId(undefined);
      return;
    }
    if (activeVoiceId && doc.voices[activeVoiceId]) return;
    setActiveVoiceId(getDefaultActiveVoiceId(doc));
  }, [doc.voices, activeVoiceId]);

  const playability = useMemo(
    () => analyzePlayability(doc, { visibleOnly: hasVoiceLayers(doc) }),
    [doc]
  );

  const rollNotes = useMemo(() => {
    const storedNotes: string[] = [];
    for (const sec of Object.values(doc.sectionsById)) {
      for (const ev of sec.events) {
        if (ev.kind !== "note") continue;
        storedNotes.push(ev.note);
      }
    }
    return buildPianoRollNotes(storedNotes);
  }, [doc]);

  const outOfRangeNotes = useMemo(
    () => findOutOfRangeNotesForCompose(doc, displayTranspose, rollNotes, { visibleOnly: hasVoiceLayers(doc) }),
    [doc, displayTranspose, rollNotes]
  );

  const consolidatePreview = useMemo(
    () => (consolidateOpen ? previewConsolidate(doc) : null),
    [consolidateOpen, doc]
  );

  const snapDiv = useMemo(() => getSnapTicks(doc, snap), [doc, snap]);

  const activeSectionEvents = useMemo(() => {
    if (!activeSectionId) return [];
    return doc.sectionsById[activeSectionId]?.events ?? [];
  }, [doc, activeSectionId]);

  function patchDoc(mut: (draft: SongDocV2) => void) {
    const next: SongDocV2 = {
      ...doc,
      timing: { ...doc.timing },
      sectionsById: structuredClone(doc.sectionsById),
      arrangement: doc.arrangement.map((x) => ({ ...x })),
    };
    mut(next);
    onDocChange(next);
  }

  function showClipboardToast(message: string) {
    setClipboardToast(message);
    if (clipboardToastRef.current) {
      clearTimeout(clipboardToastRef.current);
      clipboardToastRef.current = null;
    }
    clipboardToastRef.current = setTimeout(() => {
      setClipboardToast(null);
      clipboardToastRef.current = null;
    }, 1800);
  }

  function insertEventsAtEnd(newEvents: TimedEvent[]) {
    if (!activeSectionId || newEvents.length === 0) return;
    patchDoc((d) => {
      const sec = d.sectionsById[activeSectionId];
      if (!sec) return;
      sec.events = [...sec.events, ...newEvents];
    });
    setSelectedEventIds(new Set(newEvents.map((e) => e.id)));
    setCursorTick(firstEventTick(newEvents));
  }

  const previewRollNote = useCallback(
    (note: string, durationSec?: number) => {
      if (durationSec != null) return previewNote(note, durationSec);
      return onPreviewNote(note);
    },
    [previewNote, onPreviewNote]
  );

  const insertLineBreak = useCallback(() => {
    if (!activeSectionId) return;
    const marker: LayoutMarker = {
      kind: "marker",
      id: nanoid(),
      tick: cursorTick,
      marker: "line-break",
    };
    patchDoc((d) => {
      const sec = d.sectionsById[activeSectionId];
      if (!sec) return;
      sec.events = [...sec.events, marker];
    });
    setSelectedEventIds(new Set([marker.id]));
  }, [activeSectionId, cursorTick, doc, onDocChange]);

  const deleteSelected = useCallback(() => {
    if (selectedEventIds.size === 0 || !activeSectionId) return;
    const ids = new Set(selectedEventIds);
    patchDoc((d) => {
      const sec = d.sectionsById[activeSectionId];
      if (!sec) return;
      sec.events = sec.events.filter((e) => !ids.has(e.id));
    });
    setSelectedEventIds(new Set());
  }, [selectedEventIds, activeSectionId, doc, onDocChange]);

  const copySelection = useCallback(() => {
    if (!activeSectionId || selectedEventIds.size === 0) return;
    const json = buildTimelineClipboardPayload(activeSectionEvents, selectedEventIds);
    if (!json) return;
    navigator.clipboard.writeText(json).catch(() => {});
    showClipboardToast("Copiado");
  }, [activeSectionId, activeSectionEvents, selectedEventIds]);

  const cutSelection = useCallback(() => {
    if (!activeSectionId || selectedEventIds.size === 0) return;
    const json = buildTimelineClipboardPayload(activeSectionEvents, selectedEventIds);
    if (!json) return;
    navigator.clipboard.writeText(json).catch(() => {});
    deleteSelected();
    showClipboardToast("Cortado");
  }, [activeSectionId, activeSectionEvents, selectedEventIds, deleteSelected]);

  const pasteFromClipboard = useCallback(async () => {
    if (!activeSectionId) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const data = parseTimelineClipboardPayload(text);
    if (!data) return;
    const newEvents = offsetEventsForPaste(data.events, data.anchorTick, cursorTick, snapDiv);
    insertEventsAtEnd(newEvents);
    showClipboardToast("Pegado");
  }, [activeSectionId, cursorTick, snapDiv, activeSectionId]);

  const duplicateSelection = useCallback(() => {
    if (!activeSectionId || selectedEventIds.size === 0) return;
    const json = buildTimelineClipboardPayload(activeSectionEvents, selectedEventIds);
    if (!json) return;
    const data = parseTimelineClipboardPayload(json);
    if (!data) return;
    const pasteTick = computeDuplicatePasteTick(activeSectionEvents, selectedEventIds, snapDiv);
    const newEvents = offsetEventsForPaste(data.events, data.anchorTick, pasteTick, snapDiv);
    insertEventsAtEnd(newEvents);
    showClipboardToast("Duplicado");
  }, [activeSectionId, activeSectionEvents, selectedEventIds, snapDiv]);

  const handlePlay = useCallback(() => {
    if (!activeSectionId || playing) return;
    void playSectionFrom(doc, activeSectionId, cursorTick, displayTranspose);
  }, [activeSectionId, playing, playSectionFrom, doc, cursorTick, displayTranspose]);

  const handlePause = useCallback(() => {
    if (playing) pause();
  }, [playing, pause]);

  const handleStop = useCallback(() => {
    stopAndReset();
    setCursorTick(0);
  }, [stopAndReset]);

  const handlePlayheadChange = useCallback(
    (tick: number) => {
      if (playing) pause();
      setCursorTick(tick);
    },
    [playing, pause]
  );

  const nudgeSelection = useCallback(
    (deltaTick: number, deltaRow: number) => {
      if (!activeSectionId || selectedEventIds.size === 0) return;
      if (deltaTick === 0 && deltaRow === 0) return;
      patchDoc((d) => {
        const sec = d.sectionsById[activeSectionId];
        if (!sec) return;
        sec.events = nudgeSelectedEvents(
          sec.events,
          selectedEventIds,
          deltaTick,
          deltaRow,
          rollNotes,
          displayTranspose
        );
      });
    },
    [activeSectionId, selectedEventIds, rollNotes, displayTranspose, doc, onDocChange]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as any)?.isContentEditable) return;

      if (matchesAnyKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.delete)) {
        e.preventDefault();
        deleteSelected();
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.copy)) {
        e.preventDefault();
        copySelection();
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.cut)) {
        e.preventDefault();
        cutSelection();
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.paste)) {
        e.preventDefault();
        void pasteFromClipboard();
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.duplicate)) {
        e.preventDefault();
        duplicateSelection();
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.nudgeLeft)) {
        if (selectedEventIds.size > 0) {
          e.preventDefault();
          nudgeSelection(-snapDiv, 0);
        }
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.nudgeRight)) {
        if (selectedEventIds.size > 0) {
          e.preventDefault();
          nudgeSelection(snapDiv, 0);
        }
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.nudgeUp)) {
        if (selectedEventIds.size > 0) {
          e.preventDefault();
          nudgeSelection(0, -1);
        }
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.nudgeDown)) {
        if (selectedEventIds.size > 0) {
          e.preventDefault();
          nudgeSelection(0, 1);
        }
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.clearSelection)) {
        setSelectedEventIds(new Set());
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.playPause)) {
        e.preventDefault();
        if (playing) handlePause();
        else handlePlay();
      } else if (matchesKeyBinding(e, COMPOSER_V2_KEY_BINDINGS.transportStop)) {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    deleteSelected,
    copySelection,
    cutSelection,
    pasteFromClipboard,
    duplicateSelection,
    nudgeSelection,
    selectedEventIds.size,
    snapDiv,
    playing,
    handlePlay,
    handlePause,
    handleStop,
    doc,
    activeSectionId,
    displayTranspose,
  ]);

  const keyEnabled = useCallback(
    (noteId: NoteId) => hasFingeringForNote(noteId),
    []
  );

  async function handleKeyboardNote(rawNote: string) {
    await onPreviewNote(rawNote);
    if (!activeSectionId) return;
    const storedNote = displayToStored(rawNote, displayTranspose);
    const tick = cursorTick;
    const newNote: TimedNote = {
      kind: "note",
      id: nanoid(),
      note: storedNote,
      start: tick,
      duration: defaultNoteDuration(doc.timing),
      voiceId: resolveVoiceIdForNewNote(doc, activeVoiceId),
    };
    patchDoc((d) => {
      const sec = d.sectionsById[activeSectionId];
      if (!sec) return;
      sec.events = [...sec.events, newNote];
    });
    setSelectedEventIds(new Set([newNote.id]));
  }

  function handleJumpToConflict(target: ConflictJumpTarget) {
    const inst = doc.arrangement.find((i) => i.sectionId === target.sectionId);
    if (inst) setActiveInstanceId(inst.id);
    setScrollToTick(target.start);
    setCursorTick(target.start);
  }

  const selectionHint =
    selectedEventIds.size > 1
      ? `${selectedEventIds.size} seleccionados — Ctrl+C/V/X, Ctrl+D, flechas`
      : selectedEventIds.size === 1
      ? "Ctrl+C/V/X · Ctrl+D duplicar · flechas mover"
      : null;

  return (
    <div style={{ display: "grid", gap: 12, position: "relative" }}>
      {clipboardToast ? (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3000,
            padding: "8px 16px",
            borderRadius: 10,
            background: "rgba(30, 30, 30, 0.95)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#eaeaea",
            fontSize: 13,
            fontWeight: 700,
            pointerEvents: "none",
          }}
        >
          {clipboardToast}
        </div>
      ) : null}
      <SectionStrip
        doc={doc}
        activeInstanceId={activeInstanceId}
        onActiveInstanceChange={setActiveInstanceId}
        onDocChange={onDocChange}
        onRenameSection={onRenameSection}
      />

      <VoiceStrip
        doc={doc}
        activeVoiceId={activeVoiceId}
        onActiveVoiceIdChange={setActiveVoiceId}
        onDocChange={onDocChange}
        onRequestConsolidate={() => setConsolidateOpen(true)}
      />

      <ConfirmModal
        open={consolidateOpen && !!consolidatePreview}
        title="Consolidar voces"
        message={consolidatePreview ? buildConsolidateConfirmMessage(consolidatePreview) : ""}
        onCancel={() => setConsolidateOpen(false)}
        onConfirm={() => {
          onDocChange(consolidateVisibleVoices(doc));
          setConsolidateOpen(false);
          setActiveVoiceId(undefined);
        }}
        zIndex={1180}
      />

      <ConflictBanner
        conflicts={playability.conflicts}
        sameCellConflicts={playability.sameCellConflicts}
        outOfRangeNotes={outOfRangeNotes}
        composeTranspose={displayTranspose}
        doc={doc}
        labelMode={labelMode}
        onJumpToConflict={handleJumpToConflict}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Zoom H</span>
        <button
          onClick={() => setPxPerTick((p) => Math.max(MIN_PX_PER_TICK, p - 0.02))}
          style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "#1f1f1f", color: "#eaeaea", cursor: "pointer" }}
        >
          −
        </button>
        <button
          onClick={() => setPxPerTick((p) => Math.min(MAX_PX_PER_TICK, p + 0.02))}
          style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "#1f1f1f", color: "#eaeaea", cursor: "pointer" }}
        >
          +
        </button>
        <span style={{ fontSize: 12, opacity: 0.75, marginLeft: 4 }}>Zoom V</span>
        <button
          onClick={() => setRowHeight((h) => Math.max(MIN_ROW_HEIGHT, h - 2))}
          style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "#1f1f1f", color: "#eaeaea", cursor: "pointer" }}
        >
          −
        </button>
        <button
          onClick={() => setRowHeight((h) => Math.min(MAX_ROW_HEIGHT, h + 2))}
          style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "#1f1f1f", color: "#eaeaea", cursor: "pointer" }}
        >
          +
        </button>
        <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)", margin: "0 4px" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={transposeEnabled}
            onChange={(e) => setTransposeEnabled(e.target.checked)}
          />
          Transponer vista
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onTransposeDec}
            disabled={!transposeEnabled}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#1f1f1f",
              color: "#eaeaea",
              cursor: transposeEnabled ? "pointer" : "not-allowed",
              opacity: transposeEnabled ? 1 : 0.45,
            }}
          >
            −
          </button>
          <span style={{ fontSize: 12, minWidth: 40, textAlign: "center", fontWeight: 700 }}>
            T {displayTranspose > 0 ? `+${displayTranspose}` : displayTranspose}
          </span>
          <button
            onClick={onTransposeInc}
            disabled={!transposeEnabled}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#1f1f1f",
              color: "#eaeaea",
              cursor: transposeEnabled ? "pointer" : "not-allowed",
              opacity: transposeEnabled ? 1 : 0.45,
            }}
          >
            +
          </button>
        </div>
        <button
          onClick={() => setScrollToPlayableRequest((n) => n + 1)}
          title="Centrar la vista en las filas con digitación de ocarina (verdes)"
          style={{
            padding: "4px 12px",
            borderRadius: 8,
            border: "1px solid rgba(120, 200, 140, 0.35)",
            background: "rgba(40, 72, 52, 0.55)",
            color: "#dcefe4",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Centrar notas
        </button>
        {selectionHint ? (
          <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 8 }}>{selectionHint}</span>
        ) : (
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 8 }}>
            Clic der. panear · Alt+clic playhead · línea de tiempo · Espacio
          </span>
        )}
      </div>

      {activeSectionId ? (
        <>
          <TimelineBar
            doc={doc}
            events={activeSectionEvents}
            pxPerTick={pxPerTick}
            playheadTick={cursorTick}
            transportState={transportState}
            snap={snap}
            scrollLeft={hScrollLeft}
            onScrollLeftChange={setHScrollLeft}
            onPlayheadChange={handlePlayheadChange}
          />
          <PianoRoll
            notes={rollNotes}
            doc={doc}
            sectionId={activeSectionId}
            labelMode={labelMode}
            transpose={displayTranspose}
            snap={snap}
            pxPerTick={pxPerTick}
            rowHeight={rowHeight}
            selectedEventIds={selectedEventIds}
            onSelectionChange={setSelectedEventIds}
            onDocChange={onDocChange}
            onPreviewNote={previewRollNote}
            scrollToTick={scrollToTick}
            onScrollToTickHandled={() => setScrollToTick(null)}
            scrollToPlayableRequest={scrollToPlayableRequest}
            onCursorTickChange={handlePlayheadChange}
            activeVoiceId={activeVoiceId}
            playheadTick={cursorTick}
            transportState={transportState}
            scrollLeft={hScrollLeft}
            onViewportScroll={setHScrollLeft}
          />
        </>
      ) : (
        <div style={{ padding: 24, textAlign: "center", opacity: 0.7 }}>Sin sección activa</div>
      )}

      <TransportBar
        doc={doc}
        playing={playing}
        paused={paused}
        playheadTick={cursorTick}
        snap={snap}
        onSnapChange={setSnap}
        onTempoChange={(tempo) => patchDoc((d) => { d.timing.tempo = tempo; })}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onInsertLineBreak={insertLineBreak}
      />

      <div
        style={{
          position: "sticky",
          top: stickyTopOffset,
          zIndex: 50,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          padding: 10,
        }}
      >
        <PianoKeyboard
          notes={notes}
          labelMode={labelMode}
          onNoteClick={(n) => void handleKeyboardNote(n)}
          isEnabledNote={keyEnabled}
          fitToWidth
        />
      </div>
    </div>
  );
}
