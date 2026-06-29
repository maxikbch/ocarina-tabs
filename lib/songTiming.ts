import { DEFAULT_PPQ, type SongTiming, type Tick } from "@/lib/songDocV2";

export function defaultNoteDuration(timing: SongTiming): Tick {
  return timing.ppq;
}

export function ticksToSeconds(tick: Tick, timing: SongTiming): number {
  const { tempo, ppq } = timing;
  if (ppq <= 0 || tempo <= 0) return 0;
  return (tick / ppq) * (60 / tempo);
}

export function secondsToTicks(seconds: number, timing: SongTiming): Tick {
  const { tempo, ppq } = timing;
  if (ppq <= 0 || tempo <= 0) return 0;
  return Math.round(seconds * (tempo / 60) * ppq);
}

export function snapTick(tick: Tick, division: Tick): Tick {
  if (division <= 0) return Math.max(0, tick);
  return Math.max(0, Math.round(tick / division) * division);
}

/** Alinea al inicio de la celda de grilla bajo el cursor (mejor para colocar notas). division <= 0 = sin snap (redondeo a tick entero). */
export function snapTickFloor(tick: Tick, division: Tick): Tick {
  if (division <= 0) return Math.max(0, Math.round(tick));
  const epsilon = 1e-4;
  return Math.max(0, Math.floor((tick + epsilon) / division) * division);
}

export function quarterDivision(timing: SongTiming): Tick {
  return timing.ppq;
}

export function eighthDivision(timing: SongTiming): Tick {
  return Math.max(1, Math.round(timing.ppq / 2));
}

export function sixteenthDivision(timing: SongTiming): Tick {
  return Math.max(1, Math.round(timing.ppq / 4));
}

export function tickToBeatLabel(tick: Tick, timing: SongTiming): string {
  const beat = tick / timing.ppq;
  const bar = Math.floor(beat / 4) + 1;
  const beatInBar = (Math.floor(beat) % 4) + 1;
  return `${bar}:${beatInBar}`;
}

export { DEFAULT_PPQ };
