import { useCallback, useLayoutEffect, useRef } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { Stack } from '../../primitives';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '../../utils/animationConstants';

import { PeriodCell } from './PeriodCell';
import { getSlideEnterStyle, useSlideDirection } from './useSlideDirection';
import { callOnClick } from './utils';

export function MonthGrid({
  onSelect,
  onMonthSelect,
  highlight = 'active',
}: {
  onSelect?: () => void;
  onMonthSelect?: (date: Date) => void;
  /**
   * `active`: the month the calendar is showing (drill-down navigation).
   * `selected`: the month holding the picked value (standalone month picker).
   */
  highlight?: 'active' | 'selected';
}) {
  const { data, propGetters } = useDatePickerContext();
  const { months } = data;
  const { monthButton } = propGetters;

  // Latest-value refs keep handleMonthPress stable so memoized cells only
  // re-render when their own props change (see MonthDaysGrid in DayGrid.tsx).
  const monthsRef = useRef(months);
  const monthButtonRef = useRef(monthButton);
  useLayoutEffect(() => {
    monthsRef.current = months;
    monthButtonRef.current = monthButton;
  });

  const handleMonthPress = useCallback(
    (date: Date) => {
      const m = monthsRef.current.find(
        (item) => item.$date.getTime() === date.getTime(),
      );
      // Rehookify drops onClick from disabled getters; honor that for the
      // picker callback as well so out-of-bounds months can't be picked.
      const getter = m ? monthButtonRef.current(m) : undefined;
      if (!m || !getter?.onClick) return;
      callOnClick(getter);
      onMonthSelect?.(m.$date);
      onSelect?.();
    },
    [onMonthSelect, onSelect],
  );

  const year = months[0]?.$date.getFullYear() ?? 0;
  const direction = useSlideDirection(year);

  return (
    <Stack
      key={year}
      flexWrap="wrap"
      flexDirection="row"
      gap="$2"
      padding="$2"
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      enterStyle={getSlideEnterStyle(direction)}
    >
      {months.map((m) => (
        <PeriodCell
          key={m.$date.toString()}
          value={m.$date}
          label={m.month}
          selected={highlight === 'selected' ? m.selected : m.active}
          isNow={m.now}
          disabled={m.disabled}
          onPress={handleMonthPress}
        />
      ))}
    </Stack>
  );
}
