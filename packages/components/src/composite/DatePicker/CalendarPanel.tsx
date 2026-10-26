import { useCallback, useState } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import { YStack } from '../../primitives';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '../../utils/animationConstants';

import { CalendarHeader } from './CalendarHeader';
import { MonthGrid } from './MonthGrid';
import { SwipeableDayGrid } from './SwipeableDayGrid';
import {
  callOnClick,
  getCalendarMonthPosition,
  getEnterStyle,
  getNavBounds,
  useLatestRef,
} from './utils';
import { YearGrid, YearRangeHeader } from './YearGrid';

import type { DatePickerMode } from './type';

const dualPanelStyle = { flex: 1, flexBasis: 0 } as const;

type IViewMode = 'day' | 'month' | 'year';

export function CalendarPanel({
  calendarIndex,
  showNav,
  mode,
  onYearSelect,
  onMonthSelect,
  minDate,
  maxDate,
  isDualPanel,
}: {
  calendarIndex: number;
  showNav: 'both' | 'prev' | 'next' | 'none';
  mode: DatePickerMode;
  onYearSelect?: (year: number) => void;
  onMonthSelect?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  isDualPanel?: boolean;
}) {
  const { data, propGetters } = useDatePickerContext();
  const cal = data.calendars[calendarIndex];

  const isRangeDualPanel = mode === 'range' && isDualPanel;

  const [viewMode, setViewMode] = useState<IViewMode>('day');
  const setViewModeToDay = useCallback(() => setViewMode('day'), []);
  const setViewModeToMonth = useCallback(() => setViewMode('month'), []);
  const setViewModeToYear = useCallback(() => setViewMode('year'), []);

  const {
    isPrevDisabled,
    isNextDisabled,
    isPrevYearDisabled,
    isNextYearDisabled,
  } = getNavBounds(getCalendarMonthPosition(cal), minDate, maxDate);

  // Rehookify recreates its offset getters every render; reading them through
  // a ref keeps the handlers stable so the memoized header can bail out.
  const latest = useLatestRef({ propGetters, viewMode });

  const step = useCallback(
    (direction: 1 | -1, unit: 'view' | 'years') => {
      const { propGetters: getters, viewMode: currentView } = latest.current;
      const offset =
        unit === 'view' && currentView === 'day' ? { months: 1 } : { years: 1 };
      callOnClick(
        direction === 1
          ? getters.addOffset(offset)
          : getters.subtractOffset(offset),
      );
    },
    [latest],
  );
  const handlePrevMonth = useCallback(() => step(-1, 'view'), [step]);
  const handleNextMonth = useCallback(() => step(1, 'view'), [step]);
  const handlePrevYear = useCallback(() => step(-1, 'years'), [step]);
  const handleNextYear = useCallback(() => step(1, 'years'), [step]);

  if (!cal) return null;

  const showPrevNav = showNav === 'both' || showNav === 'prev';
  const showNextNav = showNav === 'both' || showNav === 'next';
  // The single chevrons step by month in the day view and by year in the
  // month view (see step), so their bounds follow the same unit.
  const isPrevStepDisabled =
    viewMode === 'day' ? isPrevDisabled : isPrevYearDisabled;
  const isNextStepDisabled =
    viewMode === 'day' ? isNextDisabled : isNextYearDisabled;

  return (
    <YStack {...(isDualPanel && dualPanelStyle)}>
      {viewMode === 'year' ? (
        <YearRangeHeader />
      ) : (
        <CalendarHeader
          month={viewMode === 'day' ? cal.month : ''}
          year={cal.year}
          onPrevMonth={showPrevNav ? handlePrevMonth : undefined}
          onNextMonth={showNextNav ? handleNextMonth : undefined}
          onPrevYear={
            showPrevNav && viewMode === 'day' ? handlePrevYear : undefined
          }
          onNextYear={
            showNextNav && viewMode === 'day' ? handleNextYear : undefined
          }
          isPrevDisabled={isPrevStepDisabled}
          isNextDisabled={isNextStepDisabled}
          isPrevYearDisabled={isPrevYearDisabled}
          isNextYearDisabled={isNextYearDisabled}
          onMonthClick={
            viewMode === 'day' && !isRangeDualPanel
              ? setViewModeToMonth
              : undefined
          }
          onYearClick={!isRangeDualPanel ? setViewModeToYear : undefined}
          mode={mode}
        />
      )}

      {viewMode === 'day' ? (
        <SwipeableDayGrid
          calendarIndex={calendarIndex}
          fullWidth={mode === 'range'}
          hideOutOfMonth={!!isDualPanel}
          isPrevDisabled={isPrevDisabled}
          isNextDisabled={isNextDisabled}
          minDate={minDate}
        />
      ) : null}
      {viewMode === 'day' ? null : (
        <YStack
          key={viewMode}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          enterStyle={getEnterStyle('zoom')}
        >
          {viewMode === 'month' ? (
            <MonthGrid
              onSelect={setViewModeToDay}
              onMonthSelect={onMonthSelect}
            />
          ) : (
            <YearGrid
              onSelect={setViewModeToMonth}
              onYearSelect={onYearSelect}
            />
          )}
        </YStack>
      )}
    </YStack>
  );
}
