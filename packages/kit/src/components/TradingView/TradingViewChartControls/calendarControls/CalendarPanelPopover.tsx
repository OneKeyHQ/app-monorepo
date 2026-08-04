import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../utils/NativeChartControlsShared';

import {
  buildChartTimestamp,
  clampCalendarDateToRange,
  getCalendarMaximumTimestamp,
  getChartDateFromTimestamp,
  isCalendarDateInRange,
  isCalendarMonthInRange,
  normalizeRangeEndSelection,
} from './CalendarPanelUtils';

type ICalendarPanel = 'goToDate' | 'timeRange';

export type ICalendarPanelSubmitPayload =
  | {
      panel: 'goToDate';
      timestamp: number;
    }
  | {
      panel: 'timeRange';
      from: number;
      to: number;
    };

export interface ICalendarPanelAvailableTimeRange {
  from?: number;
  to?: number;
}

type ICalendarDateContext = {
  maximumDate?: Date;
  minimumDate?: Date;
  today: Date;
};

function clampTimestampToAvailableRange(
  timestamp: number,
  availableTimeRange?: ICalendarPanelAvailableTimeRange,
) {
  return Math.min(
    availableTimeRange?.to ?? timestamp,
    Math.max(availableTimeRange?.from ?? timestamp, timestamp),
  );
}

const WEEKDAY_REFERENCE_DATES = [
  new Date(Date.UTC(2020, 5, 7)),
  new Date(Date.UTC(2020, 5, 8)),
  new Date(Date.UTC(2020, 5, 9)),
  new Date(Date.UTC(2020, 5, 10)),
  new Date(Date.UTC(2020, 5, 11)),
  new Date(Date.UTC(2020, 5, 12)),
  new Date(Date.UTC(2020, 5, 13)),
] as const;
const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => index * 15);
const DEFAULT_TIME_RANGE_SECONDS = 24 * 60 * 60;
const DEFAULT_CALENDAR_LOCALE = 'en-US';
const CALENDAR_DISPLAY_SYSTEM_OPTIONS = {
  calendar: 'gregory',
  numberingSystem: 'latn',
} as const satisfies Pick<
  Intl.DateTimeFormatOptions,
  'calendar' | 'numberingSystem'
>;

function createDateTimeFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale || DEFAULT_CALENDAR_LOCALE, options);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function compareDay(a: Date, b: Date) {
  return startOfDay(a).getTime() - startOfDay(b).getTime();
}

function getCalendarDateContext({
  chartTimezone,
  nowTimestamp,
  rangeMaximumTimestamp,
  rangeMinimumTimestamp,
}: {
  chartTimezone: string;
  nowTimestamp: number;
  rangeMaximumTimestamp?: number;
  rangeMinimumTimestamp?: number;
}): ICalendarDateContext {
  const today =
    getChartDateFromTimestamp({
      timeZone: chartTimezone,
      timestamp: nowTimestamp,
    }) ?? startOfDay(new Date(nowTimestamp * 1000));
  const maximumTimestamp = getCalendarMaximumTimestamp({
    nowTimestamp,
    rangeMaximumTimestamp,
  });
  const maximumDate = getChartDateFromTimestamp({
    timeZone: chartTimezone,
    timestamp: maximumTimestamp,
  });
  const rangeMinimumDate = getChartDateFromTimestamp({
    timeZone: chartTimezone,
    timestamp: rangeMinimumTimestamp ?? Number.NaN,
  });

  return {
    maximumDate,
    minimumDate:
      rangeMinimumDate &&
      (maximumDate === undefined ||
        compareDay(rangeMinimumDate, maximumDate) <= 0)
        ? rangeMinimumDate
        : undefined,
    today,
  };
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}`;
}

function getCalendarDayTestId(date: Date) {
  return `trading-view-calendar-day-${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildCalendarDays(monthDate: Date) {
  const firstDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstCalendarDate = new Date(firstDate);
  firstCalendarDate.setDate(firstDate.getDate() - firstDate.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCalendarDate);
    date.setDate(firstCalendarDate.getDate() + index);
    return date;
  });
}

function getCalendarDayTextColor({
  isDisabled,
  isCurrentMonth,
  isSelected,
}: {
  isDisabled: boolean;
  isCurrentMonth: boolean;
  isSelected: boolean;
}) {
  if (isDisabled) {
    return '$textDisabled';
  }
  if (isSelected) {
    return '$textInverse';
  }
  if (isCurrentMonth) {
    return '$text';
  }
  return '$textDisabled';
}

function DateField({
  value,
  dateFormatter,
  isActive,
  onPress,
  testID,
}: {
  value: Date;
  dateFormatter: Intl.DateTimeFormat;
  isActive?: boolean;
  onPress?: () => void;
  testID: string;
}) {
  const formattedDate = useMemo(
    () => dateFormatter.format(value),
    [dateFormatter, value],
  );

  return (
    <XStack
      testID={testID}
      flex={1}
      h={38}
      px="$3"
      gap="$2"
      alignItems="center"
      justifyContent="space-between"
      borderWidth="$px"
      borderColor={isActive ? '$borderActive' : '$borderStrong'}
      borderRadius="$3"
      cursor={onPress ? 'pointer' : undefined}
      onPress={onPress}
    >
      <SizableText size="$bodyLg" color="$textSubdued">
        {formattedDate}
      </SizableText>
      <Icon name="CalendarOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

function TimeField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const renderContent = useCallback(
    ({ closePopover }: { closePopover: () => void }) => (
      <YStack p="$1" maxHeight={280} overflow="scroll">
        {TIME_OPTIONS.map((option) => {
          const isSelected = option === value;
          return (
            <XStack
              key={option}
              px="$3"
              py="$2"
              borderRadius="$2"
              bg={isSelected ? '$bgActive' : '$transparent'}
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              cursor="pointer"
              onPress={() => {
                onChange(option);
                closePopover();
              }}
            >
              <SizableText
                size="$bodyLg"
                color={isSelected ? '$text' : '$textSubdued'}
              >
                {formatTime(option)}
              </SizableText>
            </XStack>
          );
        })}
      </YStack>
    ),
    [onChange, value],
  );

  return (
    <Popover
      title=""
      showHeader={false}
      usingSheet={false}
      placement="bottom-end"
      floatingPanelProps={{ width: 112 }}
      renderTrigger={
        <XStack
          w={112}
          h={38}
          px="$3"
          gap="$2"
          alignItems="center"
          justifyContent="space-between"
          borderWidth="$px"
          borderColor="$borderStrong"
          borderRadius="$3"
          cursor="pointer"
        >
          <SizableText size="$bodyLg" color="$textSubdued">
            {formatTime(value)}
          </SizableText>
          <Icon name="ClockTimeHistoryOutline" size="$5" color="$iconSubdued" />
        </XStack>
      }
      renderContent={renderContent}
    />
  );
}

function CalendarGrid({
  maximumDate,
  minimumDate,
  panel,
  monthDate,
  goToDate,
  rangeStartDate,
  rangeEndDate,
  monthYearFormatter,
  weekdayLabels,
  onDatePress,
  onMonthChange,
}: {
  maximumDate?: Date;
  minimumDate?: Date;
  panel: ICalendarPanel;
  monthDate: Date;
  goToDate: Date;
  rangeStartDate: Date;
  rangeEndDate: Date;
  monthYearFormatter: Intl.DateTimeFormat;
  weekdayLabels: readonly string[];
  onDatePress: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}) {
  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const rangeStartTime = startOfDay(rangeStartDate).getTime();
  const rangeEndTime = startOfDay(rangeEndDate).getTime();
  const monthYearLabel = useMemo(
    () => monthYearFormatter.format(monthDate),
    [monthDate, monthYearFormatter],
  );
  const previousMonthDate = addMonths(monthDate, -1);
  const nextMonthDate = addMonths(monthDate, 1);
  const canNavigateToPreviousMonth = isCalendarMonthInRange({
    maximumDate,
    minimumDate,
    monthDate: previousMonthDate,
  });
  const canNavigateToNextMonth = isCalendarMonthInRange({
    maximumDate,
    minimumDate,
    monthDate: nextMonthDate,
  });

  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between">
        <IconButton
          testID="trading-view-calendar-previous-month"
          size="small"
          variant="tertiary"
          icon="ChevronLeftOutline"
          iconSize="$5"
          disabled={!canNavigateToPreviousMonth}
          onPress={() => onMonthChange(previousMonthDate)}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
        <XStack gap="$3" alignItems="center">
          <SizableText size="$headingLg" color="$text">
            {monthYearLabel}
          </SizableText>
        </XStack>
        <IconButton
          testID="trading-view-calendar-next-month"
          size="small"
          variant="tertiary"
          icon="ChevronRightOutline"
          iconSize="$5"
          disabled={!canNavigateToNextMonth}
          onPress={() => onMonthChange(nextMonthDate)}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
      </XStack>

      <Stack h="$px" bg="$borderSubdued" />

      <XStack>
        {weekdayLabels.map((label) => (
          <XStack key={label} flex={1} justifyContent="center" py="$1">
            <SizableText size="$bodyLg" color="$textSubdued">
              {label}
            </SizableText>
          </XStack>
        ))}
      </XStack>

      <YStack gap="$1">
        {Array.from({ length: 6 }, (_, rowIndex) => (
          <XStack key={rowIndex}>
            {calendarDays.slice(rowIndex * 7, rowIndex * 7 + 7).map((date) => {
              const dayTime = startOfDay(date).getTime();
              const isDisabled = !isCalendarDateInRange({
                date,
                maximumDate,
                minimumDate,
              });
              const isCurrentMonth = date.getMonth() === monthDate.getMonth();
              const isGoToSelected =
                panel === 'goToDate' && isSameDay(date, goToDate);
              const isRangeStart =
                panel === 'timeRange' && isSameDay(date, rangeStartDate);
              const isRangeEnd =
                panel === 'timeRange' && isSameDay(date, rangeEndDate);
              const isInRange =
                panel === 'timeRange' &&
                dayTime > rangeStartTime &&
                dayTime < rangeEndTime;
              const isEndpoint = isRangeStart || isRangeEnd;
              const isSelected = isGoToSelected || isEndpoint;
              const dayTextColor = getCalendarDayTextColor({
                isDisabled,
                isCurrentMonth,
                isSelected,
              });

              return (
                <XStack
                  key={date.toISOString()}
                  testID={getCalendarDayTestId(date)}
                  flex={1}
                  h={40}
                  alignItems="center"
                  justifyContent="center"
                  bg={isInRange ? '$bgStrong' : '$transparent'}
                  borderTopLeftRadius={isRangeStart ? '$3' : undefined}
                  borderBottomLeftRadius={isRangeStart ? '$3' : undefined}
                  borderTopRightRadius={isRangeEnd ? '$3' : undefined}
                  borderBottomRightRadius={isRangeEnd ? '$3' : undefined}
                  cursor={isDisabled ? 'not-allowed' : 'pointer'}
                  onPress={isDisabled ? undefined : () => onDatePress(date)}
                >
                  <XStack
                    w={40}
                    h={40}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="$3"
                    bg={isSelected ? '$bgInverse' : '$transparent'}
                  >
                    <SizableText size="$bodyLg" color={dayTextColor}>
                      {date.getDate()}
                    </SizableText>
                  </XStack>
                </XStack>
              );
            })}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

export function CalendarPanelPopover({
  availableTimeRange,
  chartTimezone,
  onSubmit,
  onOpen,
  onControlInteraction,
}: {
  availableTimeRange?: ICalendarPanelAvailableTimeRange;
  chartTimezone: string;
  onSubmit: (payload: ICalendarPanelSubmitPayload) => void;
  onOpen?: () => void;
  onControlInteraction?: () => void;
}) {
  const intl = useIntl();
  const rangeMaximumTimestamp = availableTimeRange?.to;
  const rangeMinimumTimestamp = availableTimeRange?.from;
  const [calendarNowTimestamp, setCalendarNowTimestamp] = useState(() =>
    Math.floor(Date.now() / 1000),
  );
  const { maximumDate, minimumDate, today } = useMemo(
    () =>
      getCalendarDateContext({
        chartTimezone,
        nowTimestamp: calendarNowTimestamp,
        rangeMaximumTimestamp,
        rangeMinimumTimestamp,
      }),
    [
      calendarNowTimestamp,
      chartTimezone,
      rangeMaximumTimestamp,
      rangeMinimumTimestamp,
    ],
  );
  const dateFormatters = useMemo(
    () => ({
      date: createDateTimeFormatter(intl.locale, {
        ...CALENDAR_DISPLAY_SYSTEM_OPTIONS,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
      monthYear: createDateTimeFormatter(intl.locale, {
        ...CALENDAR_DISPLAY_SYSTEM_OPTIONS,
        year: 'numeric',
        month: 'long',
      }),
      weekday: createDateTimeFormatter(intl.locale, {
        calendar: CALENDAR_DISPLAY_SYSTEM_OPTIONS.calendar,
        weekday: 'short',
        timeZone: 'UTC',
      }),
    }),
    [intl.locale],
  );
  const weekdayLabels = useMemo(
    () =>
      WEEKDAY_REFERENCE_DATES.map((date) =>
        dateFormatters.weekday.format(date),
      ),
    [dateFormatters],
  );
  const calendarLabels = useMemo(
    () => ({
      calendar: intl.formatMessage({ id: ETranslations.global_date }),
      goToDate: intl.formatMessage({ id: ETranslations.global_go_to_date }),
      timeRange: intl.formatMessage({ id: ETranslations.global_time_range }),
      cancel: intl.formatMessage({ id: ETranslations.global_cancel }),
      goTo: intl.formatMessage({ id: ETranslations.global_go_to }),
    }),
    [intl],
  );
  const panelOptions = useMemo<readonly [ICalendarPanel, string][]>(
    () => [
      ['goToDate', calendarLabels.goToDate],
      ['timeRange', calendarLabels.timeRange],
    ],
    [calendarLabels.goToDate, calendarLabels.timeRange],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ICalendarPanel>('goToDate');
  const [monthDate, setMonthDate] = useState(today);
  const [goToDate, setGoToDate] = useState(today);
  const [goToTime, setGoToTime] = useState(0);
  const [rangeStartDate, setRangeStartDate] = useState(today);
  const [rangeEndDate, setRangeEndDate] = useState(today);
  const [rangeStartTime, setRangeStartTime] = useState(0);
  const [rangeEndTime, setRangeEndTime] = useState(0);
  const [activeRangeField, setActiveRangeField] = useState<'from' | 'to'>(
    'from',
  );

  const resetPanelState = useCallback(
    ({
      maximumDate: nextMaximumDate,
      minimumDate: nextMinimumDate,
      today: nextCalendarToday,
    }: ICalendarDateContext) => {
      const nextToday = clampCalendarDateToRange({
        date: nextCalendarToday,
        maximumDate: nextMaximumDate,
        minimumDate: nextMinimumDate,
      });
      setActivePanel('goToDate');
      setMonthDate(nextToday);
      setGoToDate(nextToday);
      setGoToTime(0);
      setRangeStartDate(nextToday);
      setRangeEndDate(nextToday);
      setRangeStartTime(0);
      setRangeEndTime(0);
      setActiveRangeField('from');
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const clampDate = (date: Date) =>
      clampCalendarDateToRange({
        date,
        maximumDate,
        minimumDate,
      });
    setGoToDate(clampDate);
    setRangeStartDate(clampDate);
    setRangeEndDate(clampDate);
    setMonthDate((currentDate) => {
      if (
        isCalendarMonthInRange({
          maximumDate,
          minimumDate,
          monthDate: currentDate,
        })
      ) {
        return currentDate;
      }
      const nextDate = clampDate(currentDate);
      return new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
    });
  }, [isOpen, maximumDate, minimumDate]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        const nextNowTimestamp = Math.floor(Date.now() / 1000);
        const nextDateContext = getCalendarDateContext({
          chartTimezone,
          nowTimestamp: nextNowTimestamp,
          rangeMaximumTimestamp,
          rangeMinimumTimestamp,
        });
        setCalendarNowTimestamp(nextNowTimestamp);
        onControlInteraction?.();
        onOpen?.();
        resetPanelState(nextDateContext);
      }
      setIsOpen(open);
    },
    [
      chartTimezone,
      onControlInteraction,
      onOpen,
      rangeMaximumTimestamp,
      rangeMinimumTimestamp,
      resetPanelState,
    ],
  );

  const handleDatePress = useCallback(
    (date: Date) => {
      if (
        !isCalendarDateInRange({
          date,
          maximumDate,
          minimumDate,
        })
      ) {
        return;
      }
      const nextDate = startOfDay(date);
      if (activePanel === 'goToDate') {
        setGoToDate(nextDate);
        return;
      }

      if (activeRangeField === 'from') {
        setRangeStartDate(nextDate);
        if (compareDay(nextDate, rangeEndDate) > 0) {
          setRangeEndDate(nextDate);
        }
        setActiveRangeField('to');
        return;
      }

      const nextRange = normalizeRangeEndSelection({
        rangeStartDate,
        nextDate,
      });
      setRangeStartDate(nextRange.rangeStartDate);
      setRangeEndDate(nextRange.rangeEndDate);
      setActiveRangeField('from');
    },
    [
      activePanel,
      activeRangeField,
      maximumDate,
      minimumDate,
      rangeEndDate,
      rangeStartDate,
    ],
  );

  const submit = useCallback((): ICalendarPanelSubmitPayload => {
    const effectiveAvailableTimeRange = {
      ...(availableTimeRange?.from === undefined
        ? {}
        : { from: availableTimeRange.from }),
      to: getCalendarMaximumTimestamp({
        nowTimestamp: Math.floor(Date.now() / 1000),
        rangeMaximumTimestamp: availableTimeRange?.to,
      }),
    };
    if (activePanel === 'goToDate') {
      return {
        panel: 'goToDate',
        timestamp: clampTimestampToAvailableRange(
          buildChartTimestamp({
            date: goToDate,
            totalMinutes: goToTime,
            timeZone: chartTimezone,
          }),
          effectiveAvailableTimeRange,
        ),
      };
    }

    const from = buildChartTimestamp({
      date: rangeStartDate,
      totalMinutes: rangeStartTime,
      timeZone: chartTimezone,
    });
    const to = buildChartTimestamp({
      date: rangeEndDate,
      totalMinutes: rangeEndTime,
      timeZone: chartTimezone,
    });
    const normalizedFrom = Math.min(from, to);
    const normalizedTo = Math.max(from, to);
    let boundedFrom = clampTimestampToAvailableRange(
      normalizedFrom,
      effectiveAvailableTimeRange,
    );
    const boundedTo = clampTimestampToAvailableRange(
      normalizedTo > normalizedFrom
        ? normalizedTo
        : normalizedFrom + DEFAULT_TIME_RANGE_SECONDS,
      effectiveAvailableTimeRange,
    );
    if (boundedTo <= boundedFrom) {
      boundedFrom = Math.max(
        effectiveAvailableTimeRange.from ?? 0,
        boundedTo - DEFAULT_TIME_RANGE_SECONDS,
      );
    }
    return {
      panel: 'timeRange',
      from: boundedFrom,
      to: boundedTo,
    };
  }, [
    activePanel,
    availableTimeRange,
    chartTimezone,
    goToDate,
    goToTime,
    rangeEndDate,
    rangeEndTime,
    rangeStartDate,
    rangeStartTime,
  ]);

  const renderContent = useCallback(
    ({ closePopover }: { closePopover: () => void }) => (
      <YStack width={328}>
        <XStack borderBottomWidth="$px" borderBottomColor="$borderSubdued">
          {panelOptions.map(([value, label]) => {
            const isActive = activePanel === value;
            return (
              <YStack
                key={value}
                testID={`trading-view-calendar-panel-${value}`}
                px="$5"
                pt="$3"
                gap="$2"
                cursor="pointer"
                onPress={() => {
                  setActivePanel(value);
                }}
              >
                <SizableText
                  size="$bodyLgMedium"
                  color={isActive ? '$text' : '$textSubdued'}
                >
                  {label}
                </SizableText>
                <Stack h="$0.5" bg={isActive ? '$text' : '$transparent'} />
              </YStack>
            );
          })}
        </XStack>

        <YStack p="$5" gap="$5">
          {activePanel === 'goToDate' ? (
            <XStack gap="$3">
              <DateField
                value={goToDate}
                dateFormatter={dateFormatters.date}
                testID="trading-view-calendar-go-to-date"
              />
              <TimeField value={goToTime} onChange={setGoToTime} />
            </XStack>
          ) : (
            <YStack gap="$3">
              <XStack gap="$3">
                <DateField
                  value={rangeStartDate}
                  dateFormatter={dateFormatters.date}
                  isActive={activeRangeField === 'from'}
                  onPress={() => setActiveRangeField('from')}
                  testID="trading-view-calendar-range-start-date"
                />
                <TimeField
                  value={rangeStartTime}
                  onChange={setRangeStartTime}
                />
              </XStack>
              <XStack gap="$3">
                <DateField
                  value={rangeEndDate}
                  dateFormatter={dateFormatters.date}
                  isActive={activeRangeField === 'to'}
                  onPress={() => setActiveRangeField('to')}
                  testID="trading-view-calendar-range-end-date"
                />
                <TimeField value={rangeEndTime} onChange={setRangeEndTime} />
              </XStack>
            </YStack>
          )}

          <CalendarGrid
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            panel={activePanel}
            monthDate={monthDate}
            goToDate={goToDate}
            rangeStartDate={rangeStartDate}
            rangeEndDate={rangeEndDate}
            monthYearFormatter={dateFormatters.monthYear}
            weekdayLabels={weekdayLabels}
            onDatePress={handleDatePress}
            onMonthChange={setMonthDate}
          />

          <XStack gap="$3">
            <Button
              testID="trading-view-calendar-cancel"
              flex={1}
              size="medium"
              variant="secondary"
              onPress={closePopover}
            >
              {calendarLabels.cancel}
            </Button>
            <Button
              testID="trading-view-calendar-submit"
              flex={1}
              size="medium"
              variant="primary"
              onPress={() => {
                onSubmit(submit());
                closePopover();
              }}
            >
              {calendarLabels.goTo}
            </Button>
          </XStack>
        </YStack>
      </YStack>
    ),
    [
      activePanel,
      activeRangeField,
      calendarLabels.cancel,
      calendarLabels.goTo,
      dateFormatters.date,
      dateFormatters.monthYear,
      goToDate,
      goToTime,
      handleDatePress,
      maximumDate,
      minimumDate,
      monthDate,
      onSubmit,
      panelOptions,
      rangeEndDate,
      rangeEndTime,
      rangeStartDate,
      rangeStartTime,
      submit,
      weekdayLabels,
    ],
  );

  return (
    <Popover
      title={calendarLabels.calendar}
      open={isOpen}
      onOpenChange={handleOpenChange}
      showHeader={false}
      usingSheet={false}
      placement="bottom-end"
      floatingPanelProps={{
        width: 328,
      }}
      renderTrigger={
        <IconButton
          testID="trading-view-native-calendar-trigger"
          size="small"
          variant="tertiary"
          icon="CalendarOutline"
          iconSize="$5"
          title={calendarLabels.calendar}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
      }
      renderContent={renderContent}
    />
  );
}
