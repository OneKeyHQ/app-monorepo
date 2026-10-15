import { useCallback, useMemo, useState } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { YStack } from '../../primitives';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '../../utils/animationConstants';

import { CalendarHeader } from './CalendarHeader';
import { MonthGrid } from './MonthGrid';
import { SwipeableDayGrid } from './SwipeableDayGrid';
import { callOnClick } from './utils';
import { YearGrid, YearRangeHeader } from './YearGrid';

import type { DatePickerMode } from './type';

const dualPanelStyle = { flex: 1, flexBasis: 0 } as const;
const emptyStyle = {} as const;
// Drill-down (month/year) views zoom in slightly so the switch from the day
// grid reads as going one level up. Android skips it, matching other
// enterStyle usages in this package.
const drillDownEnterStyle = platformEnv.isNativeAndroid
  ? undefined
  : ({ opacity: 0, scale: 0.96 } as const);

type IViewMode = 'day' | 'month' | 'year';

function useNavDisabled(calendarIndex: number, minDate?: Date, maxDate?: Date) {
  const { data } = useDatePickerContext();
  const { calendars } = data;
  const cal = calendars[calendarIndex];

  return useMemo(() => {
    if (!cal)
      return {
        isPrevDisabled: false,
        isNextDisabled: false,
        isPrevYearDisabled: false,
        isNextYearDisabled: false,
      };

    const currentMonthDay = cal.days.find((d) => d.inCurrentMonth);
    const calYear = currentMonthDay
      ? currentMonthDay.$date.getFullYear()
      : Number(cal.year);
    const calMonth = currentMonthDay ? currentMonthDay.$date.getMonth() : 0;

    const isPrevDisabled = minDate
      ? calYear < minDate.getFullYear() ||
        (calYear === minDate.getFullYear() && calMonth <= minDate.getMonth())
      : false;

    const isNextDisabled = maxDate
      ? calYear > maxDate.getFullYear() ||
        (calYear === maxDate.getFullYear() && calMonth >= maxDate.getMonth())
      : false;

    const isPrevYearDisabled = minDate
      ? calYear <= minDate.getFullYear()
      : false;

    const isNextYearDisabled = maxDate
      ? calYear >= maxDate.getFullYear()
      : false;

    return {
      isPrevDisabled,
      isNextDisabled,
      isPrevYearDisabled,
      isNextYearDisabled,
    };
  }, [cal, minDate, maxDate]);
}

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
  const { calendars } = data;
  const { addOffset, subtractOffset } = propGetters;
  const cal = calendars[calendarIndex];

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
  } = useNavDisabled(calendarIndex, minDate, maxDate);

  const getOffset = useCallback(
    () => (viewMode === 'day' ? { months: 1 } : { years: 1 }),
    [viewMode],
  );

  const handlePrevMonth = useCallback(() => {
    callOnClick(subtractOffset(getOffset()));
  }, [getOffset, subtractOffset]);

  const handleNextMonth = useCallback(() => {
    callOnClick(addOffset(getOffset()));
  }, [getOffset, addOffset]);

  const handlePrevYear = useCallback(() => {
    callOnClick(subtractOffset({ years: 1 }));
  }, [subtractOffset]);

  const handleNextYear = useCallback(() => {
    callOnClick(addOffset({ years: 1 }));
  }, [addOffset]);

  if (!cal) return null;

  const showPrevNav = showNav === 'both' || showNav === 'prev';
  const showNextNav = showNav === 'both' || showNav === 'next';
  // The single chevrons step by month in the day view and by year in the
  // month view (see getOffset), so their bounds follow the same unit.
  const isPrevStepDisabled =
    viewMode === 'day' ? isPrevDisabled : isPrevYearDisabled;
  const isNextStepDisabled =
    viewMode === 'day' ? isNextDisabled : isNextYearDisabled;

  return (
    <YStack {...(isDualPanel ? dualPanelStyle : emptyStyle)}>
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
          isPrevDisabled={showPrevNav ? isPrevStepDisabled : undefined}
          isNextDisabled={showNextNav ? isNextStepDisabled : undefined}
          isPrevYearDisabled={showPrevNav ? isPrevYearDisabled : undefined}
          isNextYearDisabled={showNextNav ? isNextYearDisabled : undefined}
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
          enterStyle={drillDownEnterStyle}
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
