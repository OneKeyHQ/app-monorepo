import { createContext, useContext } from 'react';

import { OVERLAY_LEVEL_ORDER } from './OverlayLevels';

import type { IOverlayLevel } from './types';

const OverlayLevelContext = createContext<IOverlayLevel | undefined>(undefined);

/** Provided by `OverlayView` to its content. */
export const OverlayLevelProvider = OverlayLevelContext.Provider;

/** The level of the overlay this component renders in, if any. */
export function useEnclosingOverlayLevel(): IOverlayLevel | undefined {
  return useContext(OverlayLevelContext);
}

/**
 * The level for an overlay opened from inside another one (a popover in a
 * password prompt, a tooltip on the lock screen): never below the overlay it
 * is opened from, or it would render underneath it.
 */
export function useNestedOverlayLevel(
  minimum: IOverlayLevel = 'modal',
): IOverlayLevel {
  const enclosing = useEnclosingOverlayLevel();
  if (!enclosing) {
    return minimum;
  }
  return OVERLAY_LEVEL_ORDER[enclosing] > OVERLAY_LEVEL_ORDER[minimum]
    ? enclosing
    : minimum;
}
