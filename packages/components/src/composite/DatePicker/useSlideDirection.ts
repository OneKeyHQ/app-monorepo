import { useState } from 'react';

import type { DPCalendar } from '@rehookify/datepicker';

export type ISlideDirection = -1 | 0 | 1;

const SLIDE_DISTANCE = 12;

const SLIDE_ENTER_STYLES = {
  [-1]: { opacity: 0, x: -SLIDE_DISTANCE },
  1: { opacity: 0, x: SLIDE_DISTANCE },
} as const;

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

/** Enter style for content that slides in from the side it navigated to. */
export function getSlideEnterStyle(direction: ISlideDirection) {
  return direction === 0 ? undefined : SLIDE_ENTER_STYLES[direction];
}

/**
 * Locale-independent ordinal of the month a rehookify calendar shows,
 * derived from its in-month days rather than its localized name.
 */
export function getCalendarMonthPosition(cal: DPCalendar | undefined): number {
  const date = cal?.days.find((d) => d.inCurrentMonth)?.$date;
  return date ? date.getFullYear() * 12 + date.getMonth() : 0;
}
