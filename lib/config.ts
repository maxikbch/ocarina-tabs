/**
 * Configuración global de la app.
 * Cambiá estos valores para ajustar el comportamiento sin tocar componentes.
 */

/** Si true, muestra el botón ✕ para borrar en notas, espacios y saltos (modo componer). */
export const SHOW_DELETE_BUTTONS_ON_ITEMS = false;

// --- Atajos de teclado (modificables) ---

export type KeyBinding = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Si true, exige Ctrl o Meta (útil para atajos multiplataforma Copy/Cut/Paste). */
  ctrlOrMeta?: boolean;
};

/** Compara un evento de teclado con un binding. */
export function matchesKeyBinding(e: KeyboardEvent, b: KeyBinding): boolean {
  if (e.key !== b.key) return false;
  if (b.ctrl != null && e.ctrlKey !== b.ctrl) return false;
  if (b.meta != null && e.metaKey !== b.meta) return false;
  if (b.shift != null && e.shiftKey !== b.shift) return false;
  if (b.alt != null && e.altKey !== b.alt) return false;
  if (b.ctrlOrMeta && !e.ctrlKey && !e.metaKey) return false;
  return true;
}

/** Devuelve true si el evento coincide con alguno de los bindings. */
export function matchesAnyKeyBinding(e: KeyboardEvent, bindings: KeyBinding[]): boolean {
  return bindings.some((b) => matchesKeyBinding(e, b));
}

/** Atajos del modo Componer. */
export const COMPOSER_KEY_BINDINGS = {
  clearSelection: { key: "Escape" },
  delete: [
    { key: "Delete" },
    { key: "Backspace" },
  ] as KeyBinding[],
  copy: { key: "c", ctrlOrMeta: true },
  cut: { key: "x", ctrlOrMeta: true },
  paste: { key: "v", ctrlOrMeta: true },
} as const;

/** Atajos del modo Tocar (navegación entre secciones). */
export const PLAY_MODE_KEY_BINDINGS = {
  prevSection: { key: "ArrowLeft" },
  nextSection: { key: "ArrowRight" },
} as const;

/** Atajos globales (p. ej. guardar en modo componer). */
export const APP_KEY_BINDINGS = {
  save: { key: "s", ctrlOrMeta: true },
} as const;
