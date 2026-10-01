import type { IOverlayLevel } from './types';

export const OVERLAY_LEVEL_ORDER: Record<IOverlayLevel, number> = {
  modal: 100,
  hardware: 200,
  secure: 300,
  toast: 400,
  lock: 500,
  debug: 900,
};

export const OVERLAY_LEVELS: readonly IOverlayLevel[] = (
  Object.keys(OVERLAY_LEVEL_ORDER) as IOverlayLevel[]
).toSorted((a, b) => OVERLAY_LEVEL_ORDER[a] - OVERLAY_LEVEL_ORDER[b]);

const NON_BLOCKING_LEVELS: ReadonlySet<IOverlayLevel> = new Set([
  'toast',
  'debug',
]);

export function isBlockingLevel(level: IOverlayLevel): boolean {
  return !NON_BLOCKING_LEVELS.has(level);
}

/**
 * Web z-index bands of the level layer roots (`document.body` children). In-page
 * content that must rise above a level (a drag clone over a dialog) uses a
 * value just above that level's base.
 */
export const OVERLAY_WEB_Z_INDEX_BASE: Record<IOverlayLevel, number> = {
  modal: 100_000,
  hardware: 120_000,
  secure: 160_000,
  toast: 1_000_000,
  lock: 100_000_000,
  debug: 100_000_005,
};

/** Page-scope entries always render below every global entry. */
export const OVERLAY_WEB_PAGE_Z_INDEX_BASE = 1000;
