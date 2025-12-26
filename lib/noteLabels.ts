export const NOTE_LABELS_ES: Record<string, string> = {
  C: "DO",
  D: "RE",
  E: "MI",
  F: "FA",
  G: "SOL",
  A: "LA",
  B: "SI",
};

export type NoteLabelMode = "latin" | "letter";

// Acepta: "C4", "C#4", "Db4", "A#5", etc. Devuelve [base, accidental, octave]
export function parseNoteId(noteId: string): { base: string; accidental: string; octave: string | null } | null {
  // Hacer la octava opcional. Coincide con: C, C#, Db, A4, F#5, etc.
  const m = /^([A-Ga-g])([#b]?)(-?\d{1,2})?$/.exec(noteId.trim());
  if (!m) return null;
  const base = m[1].toUpperCase();
  const accidental = m[2] ?? "";
  const octave = m[3] ?? null;
  return { base, accidental, octave };
}

export function formatNoteLabel(noteId: string, mode: NoteLabelMode): string {
  if (mode === "letter") return noteId;
  const parsed = parseNoteId(noteId);
  if (!parsed) return noteId;
  const { base, accidental, octave } = parsed;
  const name = NOTE_LABELS_ES[base] ?? base;
  // Usamos sostenidos (#) por defecto si están presentes; si viene "b", respetamos "b"
  const acc = accidental === "#" ? "#" : accidental === "b" ? "b" : "";
  return `${name}${acc}${octave ?? ""}`;
}


