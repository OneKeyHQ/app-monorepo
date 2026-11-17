import { useSyncExternalStore } from 'react';

// What hangs from the top of the window where the toasts land (the
// hardware stage's shell): its resting bottom edge in window points, 0
// while nothing is up. The toasters rest under it instead of covering it.
// Published with the surface's own targets, never per frame — the
// toasters ride there on their own clock. A leaf module on purpose: the
// eager, app-wide toasters read it without pulling the publisher in.
let obstructionBottom = 0;
const listeners = new Set<() => void>();

export function publishToastTopObstruction(bottom: number) {
  if (bottom === obstructionBottom) {
    return;
  }
  obstructionBottom = bottom;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getObstructionBottom() {
  return obstructionBottom;
}

function getNoObstruction() {
  return 0;
}

/** `enabled: false` reads 0 and never re-renders — for a toaster whose
 * toasts land elsewhere (the wide window's bottom corner). */
export function useToastTopObstruction(enabled = true) {
  const getSnapshot = enabled ? getObstructionBottom : getNoObstruction;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The air between the obstruction and the toast under it. */
export const TOAST_UNDER_OBSTRUCTION_GAP = 8;
/** The toasters' ride under the obstruction and back. */
export const TOAST_SHIFT_MS = 220;

/**
 * How far a top toaster shifts down so its first toast lands under the
 * obstruction: `toastTop` is where that toast rests on its own. Never
 * negative — a toaster already below it stays put — and never past
 * `maxToastTop`: under a card that leaves no room (a tall card on a short
 * window, the keyboard up) the toast stops there and overlaps the card's
 * foot rather than leave the screen. A worklet: the native toaster
 * re-reads it per keyboard frame.
 */
export function toastShiftUnderObstruction(
  bottom: number,
  toastTop: number,
  maxToastTop = Number.POSITIVE_INFINITY,
) {
  'worklet';

  if (bottom <= 0) {
    return 0;
  }
  const top = Math.min(bottom + TOAST_UNDER_OBSTRUCTION_GAP, maxToastTop);
  return Math.max(0, top - toastTop);
}

/** The room a toast needs above the usable area's bottom edge: a
 * two-line toast's height (~74) plus breathing air. */
export const TOAST_ROOM = 88;
