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
 * negative — a toaster already below it stays put.
 */
export function toastShiftUnderObstruction(bottom: number, toastTop: number) {
  if (bottom <= 0) {
    return 0;
  }
  return Math.max(0, bottom + TOAST_UNDER_OBSTRUCTION_GAP - toastTop);
}
