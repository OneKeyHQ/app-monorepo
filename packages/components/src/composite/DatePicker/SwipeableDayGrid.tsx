import { DayGrid } from './DayGrid';

import type { ISwipeableDayGridProps } from './SwipeableDayGridTypes';

/**
 * Web/desktop: no swipe navigation, plain day grid.
 * The native implementation lives in SwipeableDayGrid.native.tsx.
 */
export function SwipeableDayGrid({
  calendarIndex,
  fullWidth,
}: ISwipeableDayGridProps) {
  return (
    <DayGrid
      calendarIndex={calendarIndex}
      hideOutOfMonth={false}
      fullWidth={fullWidth}
    />
  );
}
