import { useSyncExternalStore } from 'react';

/**
 * The Earn window's result while the pointer (or the keyboard's focus) is on
 * an offer that isn't the picked one: that offer's rate over the picked
 * one's. The large figure shows what the same amount would earn there before
 * anything is picked, so offers compare in money, without a word added to
 * the cards (11-11). None, the picked offer's own figure
 */
let ratio: number | undefined;
let clearTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
// Leaving a card ends the preview a moment later: crossing the gap to the
// next card would otherwise flash the picked offer's figure between the two
const END_DELAY_MS = 120;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => ratio;

function publish(next?: number) {
  if (ratio === next) {
    return;
  }
  ratio = next;
  listeners.forEach((listener) => listener());
}

export function previewEarnOutcome(next: number) {
  clearTimeout(clearTimer);
  publish(next);
}

export function endEarnOutcomePreview({ isNow = false } = {}) {
  clearTimeout(clearTimer);
  if (isNow) {
    publish(undefined);
    return;
  }
  clearTimer = setTimeout(() => publish(undefined), END_DELAY_MS);
}

export function useEarnOutcomePreview() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// "$8.03" at 1.3 times the rate as "$10.44": a money figure in its own sign
// and two places. None where the text isn't one
export function scaleOutcomeFiat(figure: string, by: number) {
  const match = figure.trim().match(/^([^\d.,\s-]+)(\d[\d,]*(?:\.\d+)?)$/);
  if (!match || !Number.isFinite(by) || by < 0) {
    return undefined;
  }
  const [, sign, digits] = match;
  const value = Number(digits.replace(/,/g, '')) * by;
  return `${sign}${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
