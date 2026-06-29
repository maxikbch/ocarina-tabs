import { getDisplayNote } from "@/lib/songDoc";
import { hasFingeringForNote } from "@/lib/fingerings";
import { shiftNote } from "@/lib/notes";
import type { InvalidNoteRef } from "@/lib/songConflicts";
import type { SongDocV2, TimedEvent } from "@/lib/songDocV2";
import { getVisibleEvents, hasVoiceLayers } from "@/lib/songVoices";
import type { NoteId } from "@/lib/types";

/** Nota almacenada → fila del piano roll (visual). */
export function storedToDisplay(note: string, transpose: number): string {
  return getDisplayNote(note, transpose);
}

/** Fila del roll / tecla del teclado → nota almacenada en el doc. */
export function displayToStored(display: string, transpose: number): string {
  if (!transpose) return display;
  return shiftNote(display, transpose);
}

export function effectiveTranspose(enabled: boolean, transpose: number): number {
  return enabled ? transpose : 0;
}

export function storedNoteForFingering(display: string, transpose: number): NoteId {
  return displayToStored(display, transpose) as NoteId;
}

/** ¿La nota cae fuera del rango tocable en el roll (vista fija + transpose de composición)? */
export function isNoteOutOfRangeOnRoll(
  storedNote: string,
  composeTranspose: number,
  rollNotes: readonly string[]
): boolean {
  const display = storedToDisplay(storedNote, composeTranspose);
  if (!rollNotes.includes(display)) return true;
  return !hasFingeringForNote(display as NoteId);
}

export function findOutOfRangeNotesForCompose(
  doc: SongDocV2,
  composeTranspose: number,
  rollNotes: readonly string[],
  opts?: { visibleOnly?: boolean }
): InvalidNoteRef[] {
  const out: InvalidNoteRef[] = [];
  const filterVisible = opts?.visibleOnly && hasVoiceLayers(doc);

  for (const sec of Object.values(doc.sectionsById)) {
    const events: TimedEvent[] = filterVisible ? getVisibleEvents(sec.events, doc) : sec.events;
    for (const ev of events) {
      if (ev.kind !== "note") continue;
      if (isNoteOutOfRangeOnRoll(ev.note, composeTranspose, rollNotes)) {
        out.push({ sectionId: sec.id, noteId: ev.id, note: ev.note });
      }
    }
  }

  return out;
}
