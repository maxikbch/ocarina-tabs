import { Midi } from "@tonejs/midi";
import { nanoid } from "nanoid";
import {
  createDefaultTiming,
  DEFAULT_PPQ,
  DEFAULT_TEMPO,
  makeUniqueSectionNameV2,
  sortEventsByTick,
  type SongDocV2,
  type TimedNote,
  type VoiceDef,
} from "@/lib/songDocV2";
import { pickVoiceColor } from "@/lib/songVoices";

const PERCUSSION_CHANNEL = 9; // canal 10 en notación MIDI (0-indexed)

export type MidiImportResult = {
  doc: SongDocV2;
  warnings: string[];
};

function sectionNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.(mid|midi)$/i, "").trim();
  return base || "Importado";
}

function minNoteDurationTicks(ppq: number): number {
  return Math.max(1, Math.round(ppq / 32));
}

export function parseMidiToSongDoc(buffer: ArrayBuffer, fileName: string): MidiImportResult {
  const warnings: string[] = [];
  const midi = new Midi(buffer);

  const ppq = midi.header.ppq || DEFAULT_PPQ;
  const tempo = midi.header.tempos[0]?.bpm ?? DEFAULT_TEMPO;
  if (midi.header.tempos.length > 1) {
    warnings.push("El archivo tiene cambios de tempo; se usó el tempo inicial.");
  }

  const voices: Record<string, VoiceDef> = {};
  const allNotes: TimedNote[] = [];
  let voiceIndex = 0;
  let skippedPercussionTracks = 0;
  let skippedEmptyTracks = 0;

  for (const track of midi.tracks) {
    if (track.notes.length === 0) {
      skippedEmptyTracks++;
      continue;
    }
    if (track.channel === PERCUSSION_CHANNEL) {
      skippedPercussionTracks++;
      continue;
    }

    const voiceId = nanoid();
    const trackName = track.name?.trim();
    voices[voiceId] = {
      name: trackName || `Voz ${voiceIndex + 1}`,
      color: pickVoiceColor(voiceIndex),
      hidden: false,
    };
    voiceIndex++;

    const minDur = minNoteDurationTicks(ppq);
    for (const note of track.notes) {
      const duration = Math.max(minDur, note.durationTicks || minDur);
      allNotes.push({
        kind: "note",
        id: nanoid(),
        note: note.name,
        start: note.ticks,
        duration,
        voiceId,
      });
    }
  }

  if (skippedPercussionTracks > 0) {
    warnings.push(`Se omitieron ${skippedPercussionTracks} pista(s) de percusión (canal 10).`);
  }
  if (skippedEmptyTracks > 0) {
    warnings.push(`Se omitieron ${skippedEmptyTracks} pista(s) vacía(s).`);
  }
  if (allNotes.length === 0) {
    throw new Error("No se encontraron notas importables en el archivo MIDI.");
  }
  if (Object.keys(voices).length === 0) {
    throw new Error("No quedaron pistas con notas después de filtrar percusión.");
  }

  const sectionId = nanoid();
  const instanceId = nanoid();
  const desiredName = sectionNameFromFile(fileName);
  const emptyDoc: SongDocV2 = {
    version: 2,
    timing: createDefaultTiming(),
    sectionsById: { [sectionId]: { id: sectionId, name: desiredName, events: [] } },
    arrangement: [{ id: instanceId, sectionId }],
  };
  const sectionName = makeUniqueSectionNameV2(desiredName, emptyDoc);

  const doc: SongDocV2 = {
    version: 2,
    timing: { tempo, ppq },
    sectionsById: {
      [sectionId]: {
        id: sectionId,
        name: sectionName,
        events: sortEventsByTick(allNotes),
      },
    },
    arrangement: [{ id: instanceId, sectionId }],
    voices,
    importSource: {
      kind: "midi",
      fileName,
      importedAt: new Date().toISOString(),
    },
  };

  return { doc, warnings };
}

export function mergeMidiImportAsNewSection(
  current: SongDocV2,
  imported: SongDocV2
): SongDocV2 {
  const sourceSection = Object.values(imported.sectionsById)[0];
  if (!sourceSection) return current;

  const sectionId = nanoid();
  const instanceId = nanoid();
  const sectionName = makeUniqueSectionNameV2(sourceSection.name, current);

  const mergedVoices: Record<string, VoiceDef> = { ...(current.voices ?? {}) };
  for (const [id, def] of Object.entries(imported.voices ?? {})) {
    mergedVoices[id] = { ...def };
  }

  const events = sourceSection.events.map((ev) => {
    if (ev.kind === "note") return { ...ev, id: nanoid() };
    return { ...ev, id: nanoid() };
  });

  return {
    ...current,
    timing: { ...imported.timing },
    sectionsById: {
      ...current.sectionsById,
      [sectionId]: { id: sectionId, name: sectionName, events },
    },
    arrangement: [...current.arrangement, { id: instanceId, sectionId }],
    voices: Object.keys(mergedVoices).length > 0 ? mergedVoices : undefined,
    importSource: imported.importSource ?? current.importSource,
  };
}

export function replaceDocWithMidiImport(imported: SongDocV2): SongDocV2 {
  return imported;
}
