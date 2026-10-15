import { useDatePickerContext } from '@rehookify/datepicker';

import { YStack } from '../../primitives';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '../../utils/animationConstants';

import { MonthDaysGrid, WeekdayRow } from './DayGrid';
import {
  getCalendarMonthPosition,
  getSlideEnterStyle,
  useSlideDirection,
} from './useSlideDirection';

import type { ISwipeableDayGridProps } from './SwipeableDayGridTypes';

/**
 * Web/desktop: no swipe navigation. The day grid slides in from the side the
 * user navigated to, so month changes read as movement rather than a swap.
 * The native implementation lives in SwipeableDayGrid.native.tsx.
 */
export function SwipeableDayGrid({
  calendarIndex,
  fullWidth,
}: ISwipeableDayGridProps) {
  const { data } = useDatePickerContext();
  const position = getCalendarMonthPosition(data.calendars[calendarIndex]);
  const direction = useSlideDirection(position);

  return (
    <YStack>
      <WeekdayRow />
      <YStack
        key={position}
        transition="quick"
        animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
        enterStyle={getSlideEnterStyle(direction)}
      >
        <MonthDaysGrid
          calendarIndex={calendarIndex}
          hideOutOfMonth={false}
          fullWidth={fullWidth}
        />
      </YStack>
    </YStack>
  );
}
