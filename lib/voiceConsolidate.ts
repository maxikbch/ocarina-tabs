import { overlaps } from "@/lib/songConflicts";
import type { SongDocV2, TimedEvent, TimedNote } from "@/lib/songDocV2";
import { getVisibleNotes, hasVoiceLayers, isVoiceVisible } from "@/lib/songVoices";

export type ConsolidatePreview = {
  visibleVoiceNames: string[];
  hiddenVoiceCount: number;
  hiddenNoteCount: number;
  crossVoiceOverlapCount: number;
};

function collectNotes(doc: SongDocV2): TimedNote[] {
  const out: TimedNote[] = [];
  for (const sec of Object.values(doc.sectionsById)) {
    for (const ev of sec.events) {
      if (ev.kind === "note") out.push(ev);
    }
  }
  return out;
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
  const sectionsById: SongDocV2["sectionsById"] = {};

  for (const [id, sec] of Object.entries(doc.sectionsById)) {
    const kept = sec.events.filter((ev) => {
      if (ev.kind !== "note") return true;
      return isVoiceVisible(doc, ev.voiceId);
    });
    sectionsById[id] = {
      ...sec,
      events: stripVoiceIdFromEvents(kept),
    };
  }

  const { voices: _voices, importSource: _importSource, ...rest } = doc;
  return { ...rest, sectionsById };
}

export function buildConsolidateConfirmMessage(preview: ConsolidatePreview): string {
  const lines: string[] = [
    "Esta acción es irreversible: las capas de voces no se pueden recuperar.",
    "",
    `Voces visibles que se fusionarán (${preview.visibleVoiceNames.length}):`,
    preview.visibleVoiceNames.length > 0
      ? preview.visibleVoiceNames.map((n) => `• ${n}`).join("\n")
      : "• (ninguna)",
  ];

  if (preview.hiddenVoiceCount > 0) {
    lines.push(
      "",
      `Se descartarán ${preview.hiddenVoiceCount} voz/voces oculta(s) y ${preview.hiddenNoteCount} nota(s) asociada(s).`
    );
  }

  if (preview.crossVoiceOverlapCount > 0) {
    lines.push(
      "",
      `Hay ${preview.crossVoiceOverlapCount} solapamiento(s) temporal(es) entre voces visibles. Tras consolidar quedarán conflictos (naranja) hasta resolverlos manualmente.`
    );
  }

  lines.push("", "¿Consolidar en un arreglo monofónico?");
  return lines.join("\n");
}

export function docUsesVoiceLayers(doc: SongDocV2): boolean {
  return hasVoiceLayers(doc);
}

export function visibleNotesForPlay(doc: SongDocV2, events: TimedEvent[]): TimedEvent[] {
  if (!hasVoiceLayers(doc)) return events;
  return events.filter((ev) => {
    if (ev.kind !== "note") return true;
    return isVoiceVisible(doc, ev.voiceId);
  });
}

export function getAllVisibleNotes(doc: SongDocV2): TimedNote[] {
  const out: TimedNote[] = [];
  for (const sec of Object.values(doc.sectionsById)) {
    out.push(...getVisibleNotes(sec.events, doc));
  }
  return out;
}
