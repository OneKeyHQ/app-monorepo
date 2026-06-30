import { useCallback, useMemo, useState } from 'react';

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

import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../utils/NativeChartControlsShared';

import {
  buildChartTimestamp,
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

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => index * 15);
const DEFAULT_TIME_RANGE_SECONDS = 86_400;

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

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}`;
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
  isCurrentMonth,
  isSelected,
}: {
  isCurrentMonth: boolean;
  isSelected: boolean;
}) {
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
  isActive,
  onPress,
}: {
  value: Date;
  isActive?: boolean;
  onPress?: () => void;
}) {
  return (
    <XStack
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
        {formatDate(value)}
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
  panel,
  monthDate,
  goToDate,
  rangeStartDate,
  rangeEndDate,
  onDatePress,
  onMonthChange,
}: {
  panel: ICalendarPanel;
  monthDate: Date;
  goToDate: Date;
  rangeStartDate: Date;
  rangeEndDate: Date;
  onDatePress: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}) {
  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const rangeStartTime = startOfDay(rangeStartDate).getTime();
  const rangeEndTime = startOfDay(rangeEndDate).getTime();

  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between">
        <IconButton
          testID="trading-view-calendar-previous-month"
          size="small"
          variant="tertiary"
          icon="ChevronLeftOutline"
          iconSize="$5"
          title="Previous month"
          onPress={() => onMonthChange(addMonths(monthDate, -1))}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
        <XStack gap="$3" alignItems="center">
          <SizableText size="$headingLg" color="$text">
            {MONTH_LABELS[monthDate.getMonth()]}
          </SizableText>
          <SizableText size="$headingLg" color="$text">
            {monthDate.getFullYear()}
          </SizableText>
        </XStack>
        <IconButton
          testID="trading-view-calendar-next-month"
          size="small"
          variant="tertiary"
          icon="ChevronRightOutline"
          iconSize="$5"
          title="Next month"
          onPress={() => onMonthChange(addMonths(monthDate, 1))}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
      </XStack>

      <Stack h="$px" bg="$borderSubdued" />

      <XStack>
        {WEEKDAY_LABELS.map((label) => (
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
                isCurrentMonth,
                isSelected,
              });

              return (
                <XStack
                  key={date.toISOString()}
                  flex={1}
                  h={40}
                  alignItems="center"
                  justifyContent="center"
                  bg={isInRange ? '$bgStrong' : '$transparent'}
                  borderTopLeftRadius={isRangeStart ? '$3' : undefined}
                  borderBottomLeftRadius={isRangeStart ? '$3' : undefined}
                  borderTopRightRadius={isRangeEnd ? '$3' : undefined}
                  borderBottomRightRadius={isRangeEnd ? '$3' : undefined}
                  cursor="pointer"
                  onPress={() => onDatePress(date)}
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
  chartTimezone,
  onSubmit,
}: {
  chartTimezone: string;
  onSubmit: (payload: ICalendarPanelSubmitPayload) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ICalendarPanel>('goToDate');
  const [monthDate, setMonthDate] = useState(() => startOfDay(new Date()));
  const [goToDate, setGoToDate] = useState(today);
  const [goToTime, setGoToTime] = useState(0);
  const [rangeStartDate, setRangeStartDate] = useState(today);
  const [rangeEndDate, setRangeEndDate] = useState(today);
  const [rangeStartTime, setRangeStartTime] = useState(0);
  const [rangeEndTime, setRangeEndTime] = useState(0);
  const [activeRangeField, setActiveRangeField] = useState<'from' | 'to'>(
    'from',
  );

  const resetPanelState = useCallback(() => {
    const nextToday = startOfDay(new Date());
    setActivePanel('goToDate');
    setMonthDate(nextToday);
    setGoToDate(nextToday);
    setGoToTime(0);
    setRangeStartDate(nextToday);
    setRangeEndDate(nextToday);
    setRangeStartTime(0);
    setRangeEndTime(0);
    setActiveRangeField('from');
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        resetPanelState();
      }
      setIsOpen(open);
    },
    [resetPanelState],
  );

  const handleDatePress = useCallback(
    (date: Date) => {
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
    [activePanel, activeRangeField, rangeEndDate, rangeStartDate],
  );

  const submit = useCallback((): ICalendarPanelSubmitPayload => {
    if (activePanel === 'goToDate') {
      return {
        panel: 'goToDate',
        timestamp: buildChartTimestamp({
          date: goToDate,
          totalMinutes: goToTime,
          timeZone: chartTimezone,
        }),
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
    return {
      panel: 'timeRange',
      from: normalizedFrom,
      to:
        normalizedTo > normalizedFrom
          ? normalizedTo
          : normalizedFrom + DEFAULT_TIME_RANGE_SECONDS,
    };
  }, [
    activePanel,
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
          {(
            [
              ['goToDate', 'Go to date'],
              ['timeRange', 'Time range'],
            ] as const
          ).map(([value, label]) => {
            const isActive = activePanel === value;
            return (
              <YStack
                key={value}
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
              <DateField value={goToDate} />
              <TimeField value={goToTime} onChange={setGoToTime} />
            </XStack>
          ) : (
            <YStack gap="$3">
              <XStack gap="$3">
                <DateField
                  value={rangeStartDate}
                  isActive={activeRangeField === 'from'}
                  onPress={() => setActiveRangeField('from')}
                />
                <TimeField
                  value={rangeStartTime}
                  onChange={setRangeStartTime}
                />
              </XStack>
              <XStack gap="$3">
                <DateField
                  value={rangeEndDate}
                  isActive={activeRangeField === 'to'}
                  onPress={() => setActiveRangeField('to')}
                />
                <TimeField value={rangeEndTime} onChange={setRangeEndTime} />
              </XStack>
            </YStack>
          )}

          <CalendarGrid
            panel={activePanel}
            monthDate={monthDate}
            goToDate={goToDate}
            rangeStartDate={rangeStartDate}
            rangeEndDate={rangeEndDate}
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
              Cancel
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
              Go to
            </Button>
          </XStack>
        </YStack>
      </YStack>
    ),
    [
      activePanel,
      activeRangeField,
      goToDate,
      goToTime,
      handleDatePress,
      monthDate,
      onSubmit,
      rangeEndDate,
      rangeEndTime,
      rangeStartDate,
      rangeStartTime,
      submit,
    ],
  );

  return (
    <Popover
      title="Calendar"
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
          title="Calendar"
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
      }
      renderContent={renderContent}
    />
  );
}
