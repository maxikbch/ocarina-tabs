"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Soundfont from "soundfont-player";
import { shiftNote } from "@/lib/notes";
import { secondsToTicks, ticksToSeconds } from "@/lib/songTiming";
import type { SongDocV2, TimedNote, Tick } from "@/lib/songDocV2";
import type { NoteId } from "@/lib/types";
import { getVisibleNotes } from "@/lib/songVoices";

type PlaybackSession = {
  doc: SongDocV2;
  startTick: Tick;
  endTick: Tick;
  baseWhen: number;
  transpose: number;
};

export type UseTimedPlaybackOptions = {
  onPlayheadTick?: (tick: Tick) => void;
};

function sectionEndTick(notes: TimedNote[]): Tick {
  let end = 0;
  for (const n of notes) {
    end = Math.max(end, n.start + n.duration);
  }
  return end;
}

export function useTimedPlayback(opts?: UseTimedPlaybackOptions) {
  const audioRef = useRef<AudioContext | null>(null);
  const instrumentRef = useRef<Soundfont.Player | null>(null);
  const sessionRef = useRef<PlaybackSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const onPlayheadTickRef = useRef(opts?.onPlayheadTick);
  onPlayheadTickRef.current = opts?.onPlayheadTick;

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);

  const cancelAnimation = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const haltAudio = useCallback(() => {
    cancelAnimation();
    instrumentRef.current?.stop();
    sessionRef.current = null;
    setPlaying(false);
  }, [cancelAnimation]);

  const emitPlayhead = useCallback((tick: Tick) => {
    onPlayheadTickRef.current?.(Math.max(0, tick));
  }, []);

  const currentTickFromSession = useCallback((session: PlaybackSession): Tick => {
    const ac = audioRef.current;
    if (!ac) return session.startTick;
    const elapsedSec = Math.max(0, ac.currentTime - session.baseWhen);
    return session.startTick + secondsToTicks(elapsedSec, session.doc.timing);
  }, []);

  const finishPlayback = useCallback(
    (finalTick: Tick) => {
      haltAudio();
      setPaused(false);
      emitPlayhead(finalTick);
    },
    [haltAudio, emitPlayhead]
  );

  const startAnimationLoop = useCallback(() => {
    cancelAnimation();
    const step = () => {
      const session = sessionRef.current;
      if (!session) return;
      const tick = currentTickFromSession(session);
      if (tick >= session.endTick) {
        finishPlayback(session.endTick);
        return;
      }
      emitPlayhead(tick);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [cancelAnimation, currentTickFromSession, finishPlayback, emitPlayhead]);

  useEffect(() => {
    audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ac = audioRef.current!;
    Soundfont.instrument(ac, "acoustic_grand_piano", {
      soundfont: "FluidR3_GM",
      format: "mp3",
      nameToUrl: (name: string, sf: string, format: string) =>
        `./soundfonts/${sf}/${name}-${format}.js`,
    }).then((inst) => {
      instrumentRef.current = inst;
      setReady(true);
    });
    return () => {
      cancelAnimation();
      instrumentRef.current?.stop();
      instrumentRef.current = null;
      audioRef.current?.close().catch(() => {});
      audioRef.current = null;
    };
  }, [cancelAnimation]);

  const scheduleNotes = useCallback(
    (notes: TimedNote[], doc: SongDocV2, startTick: Tick, baseWhen: number, transpose: number): Tick => {
      const inst = instrumentRef.current;
      if (!inst) return startTick;

      const startSec = ticksToSeconds(startTick, doc.timing);
      let maxEnd = startTick;

      for (const note of notes) {
        const noteEnd = note.start + note.duration;
        if (noteEnd <= startTick) continue;

        const noteName = transpose ? shiftNote(note.note, -transpose) : note.note;
        const noteStartSec = ticksToSeconds(note.start, doc.timing);
        const durSec = ticksToSeconds(note.duration, doc.timing);

        let when = baseWhen + (noteStartSec - startSec);
        let duration = durSec;
        if (note.start < startTick) {
          const skippedSec = ticksToSeconds(startTick - note.start, doc.timing);
          duration = Math.max(0.05, durSec - skippedSec);
          when = baseWhen;
        }

        inst.play(noteName, when, { gain: 0.9, duration: Math.max(0.05, duration) });
        maxEnd = Math.max(maxEnd, noteEnd);
      }

      return maxEnd;
    },
    []
  );

  const playSectionFrom = useCallback(
    async (doc: SongDocV2, sectionId: string, startTick: Tick, transpose: number = 0) => {
      const inst = instrumentRef.current;
      const ac = audioRef.current;
      if (!inst || !ac || !ready) return;

      const sec = doc.sectionsById[sectionId];
      if (!sec) return;
      const notes = getVisibleNotes(sec.events, doc);
      if (notes.length === 0) return;

      haltAudio();
      if (ac.state !== "running") await ac.resume();

      const alignedStart = Math.max(0, startTick);
      const endTick = sectionEndTick(notes);
      if (alignedStart >= endTick) return;

      const baseWhen = ac.currentTime + 0.05;
      const playEnd = scheduleNotes(notes, doc, alignedStart, baseWhen, transpose);

      sessionRef.current = {
        doc,
        startTick: alignedStart,
        endTick: playEnd,
        baseWhen,
        transpose,
      };

      setPlaying(true);
      setPaused(false);
      emitPlayhead(alignedStart);
      startAnimationLoop();
    },
    [ready, haltAudio, scheduleNotes, emitPlayhead, startAnimationLoop]
  );

  const pause = useCallback(() => {
    const session = sessionRef.current;
    if (!session || !playing) return;
    const tick = currentTickFromSession(session);
    haltAudio();
    setPaused(true);
    emitPlayhead(tick);
  }, [playing, currentTickFromSession, haltAudio, emitPlayhead]);

  const stopAndReset = useCallback(() => {
    haltAudio();
    setPaused(false);
    emitPlayhead(0);
  }, [haltAudio, emitPlayhead]);

  const previewNote = useCallback(
    async (note: string, durationSec = 0.6) => {
      const inst = instrumentRef.current;
      const ac = audioRef.current;
      if (!inst || !ac || !ready) return;
      if (ac.state !== "running") await ac.resume();
      inst.play(note as NoteId, ac.currentTime, { gain: 0.9, duration: durationSec });
    },
    [ready]
  );

  return {
    ready,
    playing,
    paused,
    playSectionFrom,
    pause,
    stopAndReset,
    previewNote,
  };
}
