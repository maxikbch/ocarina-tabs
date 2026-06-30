import type { SongDocV2, TimedEvent, TimedNote } from "@/lib/songDocV2";
import { normalizeSongDocV2 } from "@/lib/songDocV2";

export const DEFAULT_VOICE_PALETTE = [
  "#5b8def",
  "#e05b8d",
  "#5bc98a",
  "#e0a85b",
  "#9b5be0",
  "#5be0d4",
  "#e05b5b",
  "#8de05b",
] as const;

export function hasVoiceLayers(doc: SongDocV2): boolean {
  return !!doc.voices && Object.keys(doc.voices).length > 0;
}

export function isVoiceVisible(doc: SongDocV2, voiceId: string | undefined): boolean {
  if (!voiceId) return true;
  if (!doc.voices) return true;
  const voice = doc.voices[voiceId];
  if (!voice) return true;
  return !voice.hidden;
}

export function getVisibleEvents(events: TimedEvent[], doc: SongDocV2): TimedEvent[] {
  if (!hasVoiceLayers(doc)) return events;
  return events.filter((ev) => {
    if (ev.kind !== "note") return true;
    return isVoiceVisible(doc, ev.voiceId);
  });
}

export function getVisibleNotes(events: TimedEvent[], doc: SongDocV2): TimedNote[] {
  return getVisibleEvents(events, doc).filter((e): e is TimedNote => e.kind === "note");
}

export function voiceColor(doc: SongDocV2, voiceId: string | undefined): string | undefined {
  if (!voiceId || !doc.voices) return undefined;
  return doc.voices[voiceId]?.color;
}

export function pickVoiceColor(index: number): string {
  return DEFAULT_VOICE_PALETTE[index % DEFAULT_VOICE_PALETTE.length];
}

export function getDefaultActiveVoiceId(doc: SongDocV2): string | undefined {
  if (!doc.voices) return undefined;
  const visible = Object.entries(doc.voices).find(([, v]) => !v.hidden);
  if (visible) return visible[0];
  const first = Object.keys(doc.voices)[0];
  return first;
}

export function resolveVoiceIdForNewNote(doc: SongDocV2, activeVoiceId?: string): string | undefined {
  if (!hasVoiceLayers(doc)) return undefined;
  if (activeVoiceId && doc.voices?.[activeVoiceId]) return activeVoiceId;
  return getDefaultActiveVoiceId(doc);
}

export function docHasNotes(doc: SongDocV2): boolean {
  return normalizeSongDocV2(doc).events.some((e) => e.kind === "note");
}
