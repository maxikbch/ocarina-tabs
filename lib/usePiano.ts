"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Soundfont from "soundfont-player";

export function usePiano() {
  const audioRef = useRef<AudioContext | null>(null);
  const instrumentRef = useRef<Soundfont.Player | null>(null);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    // El AudioContext debe crearse en el cliente
    audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Cargar instrumento piano (FluidR3 GM)
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
      instrumentRef.current?.stop();
      instrumentRef.current = null;
      audioRef.current?.close().catch(() => {});
      audioRef.current = null;
    };
  }, []);

  const ensureAudioStarted = useCallback(async () => {
    if (starting) return;
    const ac = audioRef.current;
    if (ac && ac.state !== "running") {
      setStarting(true);
      try {
        await ac.resume();
      } finally {
        setStarting(false);
      }
    }
  }, [starting]);

  const play = useCallback(
    async (note: string, durationSec = 0.6) => {
      await ensureAudioStarted();
      const inst = instrumentRef.current;
      const ac = audioRef.current;
      if (!inst || !ac || !ready) return;
      const when = ac.currentTime;
      inst.play(note, when, { gain: 0.9, duration: durationSec });
    },
    [ready, ensureAudioStarted]
  );

  return { ready, play };
}


