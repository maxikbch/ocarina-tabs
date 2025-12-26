import type { Fingering, HoleId } from "./types";

export type HoleDef = {
  id: HoleId;
  cx: number;
  cy: number;
  r: number;
  kind: "front" | "back";
};

// Coordenadas medidas sobre el PNG 481x336 (viewBox 0 0 481 336).
// Detectadas automáticamente (HoughCircles) y revisadas visualmente.
// Si cambiás el PNG, probablemente tengas que recalibrar.
export const HOLES: HoleDef[] = [
  // FRONT (de izquierda a derecha)
  { id: "L1",  cx:  51.0, cy: 106.4, r: 24.8, kind: "front" },
  { id: "L2",  cx: 113, cy: 102.4, r: 24.8, kind: "front" },
  { id: "L3",  cx: 166, cy:  72.4, r: 24.8, kind: "front" },
  { id: "L4",  cx: 221, cy:  46.3, r: 24.8, kind: "front" },

  { id: "R1",  cx: 245, cy: 143.3, r: 24.8, kind: "front" },
  { id: "R2",  cx: 297.0, cy: 110.4, r: 24.8, kind: "front" },
  { id: "R3",  cx: 353, cy:  90.5, r: 24.8, kind: "front" },
  { id: "R4", cx: 413, cy:  95.3, r: 24.8, kind: "front" },

  { id: "LS",  cx: 129.1, cy: 144.1, r: 12.8, kind: "front" }, // sub-hole
  { id: "RS",  cx: 280, cy:  69.1, r: 12.8, kind: "front" }, // sub-hole

  // BACK (los 2 agujeros “fuera” del cuerpo en tu imagen)
  { id: "B1", cx:  88.8, cy: 239.4, r: 24.8, kind: "back" },
  { id: "B2", cx: 249.0, cy: 239.4, r: 24.8, kind: "back" },
];

export function emptyFingering(): Fingering {
  return HOLES.reduce((acc, h) => {
    acc[h.id] = 0;
    return acc;
  }, {} as Fingering);
}
