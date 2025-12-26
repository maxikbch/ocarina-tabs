export type HoleState = 0 | 1; // 0 = abierto, 1 = tapado

export type FrontHoleId = string;

export type BackHoleId = string; // agujeros traseros (pulgares)

export type HoleId = FrontHoleId | BackHoleId;

export type Fingering = Record<HoleId, HoleState>;

export type NoteId = string; // "C4", "D4", etc.

export type NoteEvent = {
  id: string;
  note: NoteId;
  fingering: Fingering;
};
