import { overlaps } from "@/lib/songConflicts";
import type { SongDocV2, TimedEvent, TimedNote } from "@/lib/songDocV2";
import { normalizeSongDocV2 } from "@/lib/songDocV2";
import { getVisibleNotes, hasVoiceLayers, isVoiceVisible } from "@/lib/songVoices";

export type ConsolidatePreview = {
  visibleVoiceNames: string[];
  hiddenVoiceCount: number;
  hiddenNoteCount: number;
  crossVoiceOverlapCount: number;
};

function collectNotes(doc: SongDocV2): TimedNote[] {
  return normalizeSongDocV2(doc).events.filter((ev): ev is TimedNote => ev.kind === "note");
}

function countCrossVoiceOverlaps(notes: TimedNote[]): number {
  let count = 0;
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i];
      const b = notes[j];
      if (a.voiceId === b.voiceId) continue;
      if (overlaps(a, b)) count++;
    }
  }
  return count;
}

export function previewConsolidate(doc: SongDocV2): ConsolidatePreview {
  const allNotes = collectNotes(doc);
  const voices = doc.voices ?? {};

  const visibleVoiceNames: string[] = [];
  let hiddenVoiceCount = 0;
  let hiddenNoteCount = 0;

  for (const [id, def] of Object.entries(voices)) {
    if (def.hidden) {
      hiddenVoiceCount++;
      hiddenNoteCount += allNotes.filter((n) => n.voiceId === id).length;
    } else {
      visibleVoiceNames.push(def.name);
    }
  }

  const visibleNotes = allNotes.filter((n) => isVoiceVisible(doc, n.voiceId));

  return {
    visibleVoiceNames,
    hiddenVoiceCount,
    hiddenNoteCount,
    crossVoiceOverlapCount: countCrossVoiceOverlaps(visibleNotes),
  };
}

function stripVoiceIdFromEvents(events: TimedEvent[]): TimedEvent[] {
  return events.map((ev) => {
    if (ev.kind !== "note") return ev;
    const { voiceId: _v, ...rest } = ev;
    return rest;
  });
}

export function consolidateVisibleVoices(doc: SongDocV2): SongDocV2 {
  const normalized = normalizeSongDocV2(doc);
  const kept = normalized.events.filter((ev) => {
    if (ev.kind !== "note") return true;
    return isVoiceVisible(doc, ev.voiceId);
  });

  const { voices: _voices, importSource: _importSource, ...rest } = normalized;
  return { ...rest, events: stripVoiceIdFromEvents(kept) };
}

export function buildConsolidateConfirmMessage(preview: ConsolidatePreview): string {
  const lines: string[] = [
    "Esta acción es irreversible: las capas de voces no se pueden recuperar.",
    "",
    `Voces visibles que quedarán: ${preview.visibleVoiceNames.join(", ") || "(ninguna)"}.`,
  ];
  if (preview.hiddenVoiceCount > 0) {
    lines.push(`Se descartarán ${preview.hiddenVoiceCount} voz(es) oculta(s) y ${preview.hiddenNoteCount} nota(s).`);
  }
  if (preview.crossVoiceOverlapCount > 0) {
    lines.push(
      `Tras consolidar puede haber ${preview.crossVoiceOverlapCount} solapamiento(s) entre notas de distintas voces visibles.`
    );
  }
  return lines.join("\n");
}

export function countNotesInDoc(doc: SongDocV2): number {
  return collectNotes(doc).length;
}
