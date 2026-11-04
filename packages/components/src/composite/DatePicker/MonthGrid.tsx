import { useCallback, useMemo } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { PeriodGrid } from './PeriodGrid';
import { callOnClick, useLatestRef } from './utils';

import type { IPeriodGridItem } from './PeriodGrid';

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
  const latest = useLatestRef({ months, monthButton: propGetters.monthButton });

  const handlePress = useCallback(
    (value: number) => {
      const { months: list, monthButton } = latest.current;
      const m = list.find((item) => item.$date.getTime() === value);
      // Rehookify drops onClick from disabled getters; honor that for the
      // picker callback as well so out-of-bounds months can't be picked.
      const getter = m ? monthButton(m) : undefined;
      if (!m || !getter?.onClick) return;
      callOnClick(getter);
      onMonthSelect?.(m.$date);
      onSelect?.();
    },
    [latest, onMonthSelect, onSelect],
  );

  const items = useMemo<IPeriodGridItem[]>(
    () =>
      months.map((m) => ({
        value: m.$date.getTime(),
        label: m.month,
        selected: highlight === 'selected' ? m.selected : m.active,
        isNow: m.now,
        disabled: m.disabled,
      })),
    [months, highlight],
  );

  return (
    <PeriodGrid
      items={items}
      slidePosition={months[0]?.$date.getFullYear() ?? 0}
      onPress={handlePress}
    />
  );
}
