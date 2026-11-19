import { useState } from 'react';

import type { ISlideDirection } from './utils';

/**
 * Tracks which way an ordinal position (month index, year, decade…) last
 * moved. Uses the "store previous value in state" pattern so the direction is
 * available in the same render that receives the new position.
 */
export function useSlideDirection(position: number): ISlideDirection {
  const [prevPosition, setPrevPosition] = useState(position);
  const [direction, setDirection] = useState<ISlideDirection>(0);
  if (position !== prevPosition) {
    setPrevPosition(position);
    setDirection(position > prevPosition ? 1 : -1);
  }
  return direction;
}
