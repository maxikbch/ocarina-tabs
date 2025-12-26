import { parseNoteId } from "./noteLabels";

const STEPS_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;

function stepIndex(name: string): number {
  const idx = STEPS_SHARP.indexOf(name as any);
  return idx;
}

function toIndex(noteId: string): number {
  const p = parseNoteId(noteId);
  if (!p) throw new Error(`Nota inválida: ${noteId}`);
  const stepName = (p.base + p.accidental) as string;
  const idx = stepIndex(stepName);
  if (idx < 0) throw new Error(`Paso inválido: ${stepName}`);
  if (p.octave == null) {
    throw new Error(`La nota requiere octava para rango cromático: ${noteId}`);
  }
  const oct = parseInt(p.octave, 10);
  return oct * 12 + idx;
}

function fromIndex(i: number): string {
  const oct = Math.floor(i / 12);
  const step = i % 12;
  const name = STEPS_SHARP[step];
  return `${name}${oct}`;
}

export function buildChromaticRange(opts: { from: string; to: string }): string[] {
  const a = toIndex(opts.from);
  const b = toIndex(opts.to);
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  const out: string[] = [];
  for (let i = start; i <= end; i++) {
    out.push(fromIndex(i));
  }
  return out;
}

// Desplaza una nota N semitonos (positivo hacia arriba, negativo hacia abajo)
export function shiftNote(noteId: string, semitones: number): string {
  if (!semitones) return noteId;
  const idx = toIndex(noteId);
  const shifted = idx + semitones;
  return fromIndex(shifted);
}


