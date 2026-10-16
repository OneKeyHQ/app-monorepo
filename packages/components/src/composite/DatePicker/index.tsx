import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { DatePickerProvider } from '@rehookify/datepicker';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Popover } from '../../actions/Popover';
import { useMedia } from '../../hooks';
import { Button, XStack, YStack } from '../../primitives';
import { withStaticProperties } from '../../shared/tamagui';

import { Calendar } from './Calendar';
import { DatePickerTrigger } from './DatePickerTrigger';
import { PRESETS_SIDEBAR_WIDTH, PresetsSidebar } from './PresetsSidebar';
import {
  SWIPE_PAGER_OFFSETS,
  useSwipeMonthNavEnabled,
} from './useSwipeMonthNavEnabled';

import type {
  DatePickerMode,
  IDatePickerBaseProps,
  IDatePickerProps,
  IDatePickerRenderTriggerProps,
  IDateRange,
  IDateRangePreset,
  IMonthPickerProps,
  IMultiSelectPickerProps,
  IRangePickerProps,
  IYearPickerProps,
} from './type';

const WEEK_START_MONDAY = 1 as const;

const createPickerConfig = ({
  selectedDates,
  onDatesChange,
  minDate,
  maxDate,
  mode = 'single',
  calendarMode,
  locale,
  showPreviousMonth,
  enableSwipeMonthNav,
}: {
  selectedDates: Date[];
  onDatesChange: (dates: Date[]) => void;
  minDate?: Date;
  maxDate?: Date;
  mode?: 'single' | 'range' | 'multiple';
  calendarMode?: 'static';
  locale?: string;
  showPreviousMonth?: boolean;
  enableSwipeMonthNav?: boolean;
}) => {
  let offsets: number[] | undefined;
  if (calendarMode !== 'static' && enableSwipeMonthNav) {
    offsets = SWIPE_PAGER_OFFSETS;
  } else if (mode === 'range') {
    offsets = showPreviousMonth ? [-1] : [1];
  }

  const config: React.ComponentProps<typeof DatePickerProvider>['config'] = {
    selectedDates,
    onDatesChange,
    dates: {
      mode,
      minDate,
      maxDate,
      selectSameDate: mode !== 'range' ? true : undefined,
    },
    calendar: {
      startDay: WEEK_START_MONDAY,
      mode: calendarMode,
      offsets,
    },
    locale: locale ? { locale } : undefined,
  };

  return config;
};

function usePickerState({
  disabled,
  onOpenChange,
}: Pick<IDatePickerBaseProps, 'disabled' | 'onOpenChange'>) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (disabled && open) return;
      setIsOpen(open);
      onOpenChange?.(open);
    },
    [disabled, onOpenChange],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  return { isOpen, handleOpenChange, close };
}

function usePickerI18n(
  placeholderProp: string | undefined,
  titleProp: string | undefined,
  translationKey: ETranslations,
) {
  const intl = useIntl();
  const fallback = intl.formatMessage({ id: translationKey });
  return {
    placeholder: placeholderProp ?? fallback,
    title: titleProp ?? fallback,
    locale: intl.locale,
  };
}

function PickerPopover({
  title,
  isOpen,
  onOpenChange,
  renderTrigger,
  renderContent,
  floatingPanelProps,
  sheetProps,
}: {
  title: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  renderTrigger: ReactElement;
  renderContent: ReactElement;
  floatingPanelProps?: IDatePickerBaseProps['floatingPanelProps'];
  sheetProps?: IDatePickerBaseProps['sheetProps'];
}) {
  return (
    <Popover
      title={title}
      showHeader={false}
      open={isOpen}
      onOpenChange={onOpenChange}
      renderTrigger={renderTrigger}
      renderContent={renderContent}
      floatingPanelProps={floatingPanelProps}
      sheetProps={sheetProps}
    />
  );
}

function renderPickerTrigger({
  renderTrigger,
  value,
  mode,
  placeholder,
  disabled,
  onClear,
}: {
  renderTrigger?: (props: IDatePickerRenderTriggerProps) => ReactElement;
  value: IDatePickerRenderTriggerProps['value'];
  mode: DatePickerMode;
  placeholder: string;
  disabled?: boolean;
  onClear: () => void;
}) {
  if (renderTrigger) {
    return renderTrigger({ value, mode, placeholder, disabled, onClear });
  }
  return (
    <DatePickerTrigger
      value={value}
      mode={mode}
      placeholder={placeholder}
      disabled={disabled}
      onClear={onClear}
    />
  );
}

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isDayWithinBounds(day: Date, minDate?: Date, maxDate?: Date) {
  const dayTime = day.getTime();
  if (minDate) {
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    if (dayTime < min.getTime()) return false;
  }
  if (maxDate) {
    const max = new Date(maxDate);
    max.setHours(0, 0, 0, 0);
    if (dayTime > max.getTime()) return false;
  }
  return true;
}

function TodayShortcut({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  return (
    <XStack
      justifyContent="center"
      marginTop="$3"
      paddingTop="$3"
      borderTopWidth={1}
      borderTopColor="$borderSubdued"
    >
      {/* Internal calendar shortcut; QA targets the wrapping date picker. */}
      {/* oxlint-disable-next-line onekey/require-testid */}
      <Button size="small" variant="tertiary" onPress={onPress}>
        {intl.formatMessage({ id: ETranslations.global_date_today })}
      </Button>
    </XStack>
  );
}

// 7 x 40px day columns + 2 x $3 padding: whole-pixel columns, no overlap.
const SINGLE_PANEL_CONTENT_WIDTH = 280;
const SINGLE_PANEL_WIDTH = SINGLE_PANEL_CONTENT_WIDTH + 2 * 12;
const SINGLE_PANEL_PROPS = {
  w: SINGLE_PANEL_WIDTH,
  minWidth: SINGLE_PANEL_WIDTH,
} as const;
const GT_MD_PADDING_4 = { padding: '$4' } as const;
// Mobile sheet card (24px radius, like other popover sheets' $5 content
// padding): $5 top/bottom, $4 sides so 7 x 40px columns still fit a 360pt
// screen inside the sheet's $5 side margins.
const MD_SHEET_PADDING = {
  paddingHorizontal: '$4',
  paddingVertical: '$5',
} as const;

function BasicDatePicker({
  value,
  onChange,
  onOpenChange,
  disabled,
  placeholder: placeholderProp,
  title: titleProp,
  renderTrigger,
  minDate,
  maxDate,
  floatingPanelProps,
  sheetProps,
}: IDatePickerProps) {
  const { placeholder, title, locale } = usePickerI18n(
    placeholderProp,
    titleProp,
    ETranslations.global_select_date,
  );
  const { isOpen, handleOpenChange, close } = usePickerState({
    disabled,
    onOpenChange,
  });

  const selectedDates = useMemo(() => (value ? [value] : []), [value]);

  const handleDatesChange = useCallback(
    (dates: Date[]) => {
      onChange?.(dates[0] || null);
      close();
    },
    [onChange, close],
  );

  const enableSwipeMonthNav = useSwipeMonthNavEnabled();

  const config = useMemo(
    () =>
      createPickerConfig({
        selectedDates,
        onDatesChange: handleDatesChange,
        minDate,
        maxDate,
        locale,
        enableSwipeMonthNav,
      }),
    [
      selectedDates,
      handleDatesChange,
      minDate,
      maxDate,
      locale,
      enableSwipeMonthNav,
    ],
  );

  const mergedFloatingPanelProps = useMemo(
    () => ({ ...SINGLE_PANEL_PROPS, ...floatingPanelProps }),
    [floatingPanelProps],
  );

  const handleSelectToday = useCallback(() => {
    onChange?.(getToday());
    close();
  }, [onChange, close]);

  // Re-evaluated every render (opening re-renders), so a picker left mounted
  // past midnight still offers the right day.
  const canSelectToday = isDayWithinBounds(getToday(), minDate, maxDate);

  const pickerContent = useMemo(
    () => (
      <YStack
        padding="$3"
        minWidth={SINGLE_PANEL_CONTENT_WIDTH}
        $md={MD_SHEET_PADDING}
      >
        <DatePickerProvider config={config}>
          <Calendar mode="date" minDate={minDate} maxDate={maxDate} />
        </DatePickerProvider>
        {canSelectToday ? <TodayShortcut onPress={handleSelectToday} /> : null}
      </YStack>
    ),
    [config, minDate, maxDate, canSelectToday, handleSelectToday],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={mergedFloatingPanelProps}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'date',
        placeholder,
        disabled,
        onClear: () => onChange?.(null),
      })}
      renderContent={pickerContent}
    />
  );
}

function RangePickerContent({
  minDate,
  maxDate,
  locale,
  showPreviousMonth,
  presets,
  hasPresets,
  value,
  onChange,
  close,
}: {
  minDate?: Date;
  maxDate?: Date;
  locale: string;
  showPreviousMonth?: boolean;
  presets?: IDateRangePreset[];
  hasPresets: boolean;
  value?: IDateRange;
  onChange?: (range: IDateRange) => void;
  close: () => void;
}) {
  // A half-picked range is a draft owned by the open picker: onChange fires
  // only once both ends are chosen. The popover unmounts its content on
  // close, so dismissing mid-pick drops the draft and the committed value
  // stays untouched (no `{ start, end: null }` leaks to consumers).
  const [draftDates, setDraftDates] = useState<Date[] | null>(null);

  // A value pushed from outside while the picker is open supersedes the draft.
  // Compared by timestamps: consumers often rebuild the range object on every
  // render, which must not wipe an in-progress pick.
  const valueKey = `${value?.start?.getTime() ?? ''}-${
    value?.end?.getTime() ?? ''
  }`;
  const [draftValueKey, setDraftValueKey] = useState(valueKey);
  if (draftValueKey !== valueKey) {
    setDraftValueKey(valueKey);
    setDraftDates(null);
  }

  const committedDates = useMemo(
    () =>
      [value?.start, value?.end].filter((d): d is Date => d instanceof Date),
    [value],
  );

  const handleDatesChange = useCallback(
    (dates: Date[]) => {
      if (dates.length < 2) {
        setDraftDates(dates);
        return;
      }
      onChange?.({ start: dates[0], end: dates[1] });
      close();
    },
    [onChange, close],
  );

  const handlePresetSelect = useCallback(
    (range: IDateRange) => {
      onChange?.(range);
      close();
    },
    [onChange, close],
  );

  const enableSwipeMonthNav = useSwipeMonthNavEnabled();

  const config = useMemo(
    () =>
      createPickerConfig({
        selectedDates: draftDates ?? committedDates,
        onDatesChange: handleDatesChange,
        minDate,
        maxDate,
        mode: 'range',
        locale,
        showPreviousMonth,
        enableSwipeMonthNav,
      }),
    [
      draftDates,
      committedDates,
      handleDatesChange,
      minDate,
      maxDate,
      locale,
      showPreviousMonth,
      enableSwipeMonthNav,
    ],
  );

  return (
    <XStack>
      {hasPresets && presets ? (
        <PresetsSidebar
          presets={presets}
          value={value}
          onSelect={handlePresetSelect}
        />
      ) : null}
      <YStack
        padding="$3"
        minWidth={SINGLE_PANEL_CONTENT_WIDTH}
        flex={1}
        $md={MD_SHEET_PADDING}
        $gtMd={GT_MD_PADDING_4}
      >
        <DatePickerProvider config={config}>
          <Calendar
            mode="range"
            minDate={minDate}
            maxDate={maxDate}
            showPreviousMonth={showPreviousMonth}
          />
        </DatePickerProvider>
      </YStack>
    </XStack>
  );
}

// Dual-panel range: 2 x (7 x 40px day columns) + 2 x $4 gap + 1px divider
// + 2 x $4 panel padding, so day columns are exactly 40px wide.
const RANGE_PANEL_WIDTH = 2 * 280 + 2 * 16 + 1 + 2 * 16;

function RangePicker({
  value,
  onChange,
  onOpenChange,
  disabled,
  placeholder: placeholderProp,
  title: titleProp,
  renderTrigger,
  minDate,
  maxDate,
  floatingPanelProps,
  sheetProps,
  showPreviousMonth,
  presets,
}: IRangePickerProps) {
  const { placeholder, title, locale } = usePickerI18n(
    placeholderProp,
    titleProp,
    ETranslations.global_select_date_range,
  );
  const { isOpen, handleOpenChange, close } = usePickerState({
    disabled,
    onOpenChange,
  });
  const media = useMedia();
  const hasPresets = !!presets && presets.length > 0 && media.gtMd;

  const panelWidth = hasPresets
    ? RANGE_PANEL_WIDTH + PRESETS_SIDEBAR_WIDTH
    : RANGE_PANEL_WIDTH;

  const rangeFloatingPanelProps = useMemo(
    () => ({
      w: panelWidth,
      maxWidth: panelWidth,
      ...floatingPanelProps,
    }),
    [panelWidth, floatingPanelProps],
  );

  const rangeContent = useMemo(
    () => (
      <RangePickerContent
        minDate={minDate}
        maxDate={maxDate}
        locale={locale}
        showPreviousMonth={showPreviousMonth}
        presets={presets}
        hasPresets={hasPresets}
        value={value}
        onChange={onChange}
        close={close}
      />
    ),
    [
      minDate,
      maxDate,
      locale,
      showPreviousMonth,
      presets,
      hasPresets,
      value,
      onChange,
      close,
    ],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={rangeFloatingPanelProps}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'range',
        placeholder,
        disabled,
        onClear: () => onChange?.({ start: null, end: null }),
      })}
      renderContent={rangeContent}
    />
  );
}

function YearPicker({
  value,
  onChange,
  onOpenChange,
  disabled,
  placeholder: placeholderProp,
  title: titleProp,
  renderTrigger,
  minDate,
  maxDate,
  floatingPanelProps,
  sheetProps,
}: IYearPickerProps) {
  const { placeholder, title, locale } = usePickerI18n(
    placeholderProp,
    titleProp,
    ETranslations.global_select_year,
  );
  const { isOpen, handleOpenChange, close } = usePickerState({
    disabled,
    onOpenChange,
  });

  const selectedDates = useMemo(() => (value ? [value] : []), [value]);

  const handleDatesChange = useCallback(
    (dates: Date[]) => {
      onChange?.(dates[0] || null);
      close();
    },
    [onChange, close],
  );

  const config = useMemo(
    () =>
      createPickerConfig({
        selectedDates,
        onDatesChange: handleDatesChange,
        minDate,
        maxDate,
        calendarMode: 'static',
        locale,
      }),
    [selectedDates, handleDatesChange, minDate, maxDate, locale],
  );

  const handleYearSelect = useCallback(
    (year: number) => {
      onChange?.(new Date(year, 0, 1));
      close();
    },
    [onChange, close],
  );

  const yearFloatingPanelProps = useMemo(
    () => ({ ...SINGLE_PANEL_PROPS, ...floatingPanelProps }),
    [floatingPanelProps],
  );

  const yearContent = useMemo(
    () => (
      <YStack
        padding="$3"
        minWidth={SINGLE_PANEL_CONTENT_WIDTH}
        $md={MD_SHEET_PADDING}
      >
        <DatePickerProvider config={config}>
          <Calendar
            mode="year"
            minDate={minDate}
            maxDate={maxDate}
            onYearSelect={handleYearSelect}
          />
        </DatePickerProvider>
      </YStack>
    ),
    [config, minDate, maxDate, handleYearSelect],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={yearFloatingPanelProps}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'year',
        placeholder,
        disabled,
        onClear: () => onChange?.(null),
      })}
      renderContent={yearContent}
    />
  );
}

function MonthPicker({
  value,
  onChange,
  onOpenChange,
  disabled,
  placeholder: placeholderProp,
  title: titleProp,
  renderTrigger,
  minDate,
  maxDate,
  floatingPanelProps,
  sheetProps,
}: IMonthPickerProps) {
  const { placeholder, title, locale } = usePickerI18n(
    placeholderProp,
    titleProp,
    ETranslations.global_select_month,
  );
  const { isOpen, handleOpenChange, close } = usePickerState({
    disabled,
    onOpenChange,
  });

  const selectedDates = useMemo(() => (value ? [value] : []), [value]);

  const handleDatesChange = useCallback(
    (dates: Date[]) => {
      onChange?.(dates[0] || null);
      close();
    },
    [onChange, close],
  );

  const config = useMemo(
    () =>
      createPickerConfig({
        selectedDates,
        onDatesChange: handleDatesChange,
        minDate,
        maxDate,
        calendarMode: 'static',
        locale,
      }),
    [selectedDates, handleDatesChange, minDate, maxDate, locale],
  );

  const handleMonthSelect = useCallback(
    (date: Date) => {
      onChange?.(new Date(date.getFullYear(), date.getMonth(), 1));
      close();
    },
    [onChange, close],
  );

  const monthFloatingPanelProps = useMemo(
    () => ({ ...SINGLE_PANEL_PROPS, ...floatingPanelProps }),
    [floatingPanelProps],
  );

  const monthContent = useMemo(
    () => (
      <YStack
        padding="$3"
        minWidth={SINGLE_PANEL_CONTENT_WIDTH}
        $md={MD_SHEET_PADDING}
      >
        <DatePickerProvider config={config}>
          <Calendar
            mode="month"
            minDate={minDate}
            maxDate={maxDate}
            onMonthSelect={handleMonthSelect}
          />
        </DatePickerProvider>
      </YStack>
    ),
    [config, minDate, maxDate, handleMonthSelect],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={monthFloatingPanelProps}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'month',
        placeholder,
        disabled,
        onClear: () => onChange?.(null),
      })}
      renderContent={monthContent}
    />
  );
}

function MultiSelectPicker({
  value = [],
  onChange,
  onOpenChange,
  disabled,
  placeholder: placeholderProp,
  title: titleProp,
  renderTrigger,
  minDate,
  maxDate,
  floatingPanelProps,
  sheetProps,
}: IMultiSelectPickerProps) {
  const { placeholder, title, locale } = usePickerI18n(
    placeholderProp,
    titleProp,
    ETranslations.global_select_dates,
  );
  const { isOpen, handleOpenChange } = usePickerState({
    disabled,
    onOpenChange,
  });

  const handleDatesChange = useCallback(
    (dates: Date[]) => onChange?.(dates),
    [onChange],
  );

  const enableSwipeMonthNav = useSwipeMonthNavEnabled();

  const config = useMemo(
    () =>
      createPickerConfig({
        selectedDates: value,
        onDatesChange: handleDatesChange,
        minDate,
        maxDate,
        mode: 'multiple',
        locale,
        enableSwipeMonthNav,
      }),
    [value, handleDatesChange, minDate, maxDate, locale, enableSwipeMonthNav],
  );

  const multiFloatingPanelProps = useMemo(
    () => ({ ...SINGLE_PANEL_PROPS, ...floatingPanelProps }),
    [floatingPanelProps],
  );

  const multiContent = useMemo(
    () => (
      <YStack
        padding="$3"
        minWidth={SINGLE_PANEL_CONTENT_WIDTH}
        $md={MD_SHEET_PADDING}
      >
        <DatePickerProvider config={config}>
          <Calendar mode="multiple" minDate={minDate} maxDate={maxDate} />
        </DatePickerProvider>
      </YStack>
    ),
    [config, minDate, maxDate],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={multiFloatingPanelProps}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'multiple',
        placeholder,
        disabled,
        onClear: () => onChange?.([]),
      })}
      renderContent={multiContent}
    />
  );
}

export const DatePicker = withStaticProperties(BasicDatePicker, {
  Range: RangePicker,
  Year: YearPicker,
  Month: MonthPicker,
  MultiSelect: MultiSelectPicker,
  Calendar,
  Trigger: DatePickerTrigger,
});

export * from './type';
