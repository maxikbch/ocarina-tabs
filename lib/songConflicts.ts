import { hasFingeringForNote } from "@/lib/fingerings";
import type { NoteId } from "@/lib/types";
import type { SongDocV2, TimedEvent, TimedNote } from "@/lib/songDocV2";
import { getVisibleEvents, hasVoiceLayers } from "@/lib/songVoices";

export type ConflictGroup = {
  id: string;
  sectionId: string;
  noteIds: string[];
  start: number;
  end: number;
};

/** Dos o más notas con el mismo pitch en el mismo tick (misma fila y columna). */
export type SameCellConflict = {
  id: string;
  sectionId: string;
  noteIds: string[];
  note: string;
  start: number;
};

export type InvalidNoteRef = {
  sectionId: string;
  noteId: string;
  note: string;
};

export type SongPlayability = {
  playable: boolean;
  conflicts: ConflictGroup[];
  sameCellConflicts: SameCellConflict[];
  invalidNotes: InvalidNoteRef[];
};

export function overlaps(a: TimedNote, b: TimedNote): boolean {
  return a.start < b.start + b.duration && b.start < a.start + a.duration;
}

function buildConflictGroup(sectionId: string, notes: TimedNote[]): ConflictGroup {
  const start = Math.min(...notes.map((n) => n.start));
  const end = Math.max(...notes.map((n) => n.start + n.duration));
  return {
    id: `${sectionId}:${start}:${end}`,
    sectionId,
    noteIds: notes.map((n) => n.id),
    start,
    end,
  };
}

export function findConflictsInSection(sectionId: string, events: TimedEvent[]): ConflictGroup[] {
  const notes = events
    .filter((e): e is TimedNote => e.kind === "note" && e.duration > 0)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

  const groups: ConflictGroup[] = [];
  let current: TimedNote[] = [];
  let currentEnd = 0;

  for (const note of notes) {
    if (current.length === 0 || note.start < currentEnd) {
      current.push(note);
      currentEnd = Math.max(currentEnd, note.start + note.duration);
    } else {
      if (current.length > 1) groups.push(buildConflictGroup(sectionId, current));
      current = [note];
      currentEnd = note.start + note.duration;
    }
  }
  if (current.length > 1) groups.push(buildConflictGroup(sectionId, current));

  return groups;
}

export function findSameCellConflictsInSection(sectionId: string, events: TimedEvent[]): SameCellConflict[] {
  const notes = events.filter((e): e is TimedNote => e.kind === "note" && e.duration > 0);
  const byCell = new Map<string, TimedNote[]>();

  for (const note of notes) {
    const key = `${note.note}@${note.start}`;
    const group = byCell.get(key) ?? [];
    group.push(note);
    byCell.set(key, group);
  }

  const out: SameCellConflict[] = [];
  for (const [, group] of byCell) {
    if (group.length < 2) continue;
    const { note, start } = group[0];
    out.push({
      id: `${sectionId}:cell:${note}:${start}`,
      sectionId,
      noteIds: group.map((n) => n.id),
      note,
      start,
    });
  }

  return out.sort((a, b) => a.start - b.start || a.note.localeCompare(b.note));
}

export function findInvalidNotesInSection(sectionId: string, events: TimedEvent[]): InvalidNoteRef[] {
  const out: InvalidNoteRef[] = [];
  for (const ev of events) {
    if (ev.kind !== "note") continue;
    if (!hasFingeringForNote(ev.note as NoteId)) {
      out.push({ sectionId, noteId: ev.id, note: ev.note });
    }
  }
  return out;
}

export function analyzePlayability(
  doc: SongDocV2,
  opts?: { visibleOnly?: boolean }
): SongPlayability {
  const conflicts: ConflictGroup[] = [];
  const sameCellConflicts: SameCellConflict[] = [];
  const invalidNotes: InvalidNoteRef[] = [];
  const filterVisible = opts?.visibleOnly && hasVoiceLayers(doc);

  for (const sec of Object.values(doc.sectionsById)) {
    const events = filterVisible ? getVisibleEvents(sec.events, doc) : sec.events;
    conflicts.push(...findConflictsInSection(sec.id, events));
    sameCellConflicts.push(...findSameCellConflictsInSection(sec.id, events));
    invalidNotes.push(...findInvalidNotesInSection(sec.id, events));
  }

  return {
    playable: conflicts.length === 0,
    conflicts,
    sameCellConflicts,
    invalidNotes,
  };
}

export function getSameCellNoteIds(doc: SongDocV2): Set<string> {
  const ids = new Set<string>();
  const visibleOnly = hasVoiceLayers(doc);
  for (const g of analyzePlayability(doc, { visibleOnly }).sameCellConflicts) {
    for (const id of g.noteIds) ids.add(id);
  }
  return ids;
}

export function getConflictingNoteIds(doc: SongDocV2): Set<string> {
  const visibleOnly = hasVoiceLayers(doc);
  const playability = analyzePlayability(doc, { visibleOnly });
  const ids = new Set<string>();
  for (const g of playability.conflicts) {
    for (const id of g.noteIds) ids.add(id);
  }
  return ids;
}
