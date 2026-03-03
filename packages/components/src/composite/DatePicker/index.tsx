import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { DatePickerProvider } from '@rehookify/datepicker';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Popover } from '../../actions/Popover';
import { useMedia } from '../../hooks';
import { XStack, YStack } from '../../primitives';
import { withStaticProperties } from '../../shared/tamagui';

import { Calendar } from './Calendar';
import { DatePickerTrigger } from './DatePickerTrigger';
import { PresetsSidebar } from './PresetsSidebar';

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

const createPickerConfig = (
  selectedDates: Date[],
  handleDatesChange: (dates: Date[]) => void,
  minDate?: Date,
  maxDate?: Date,
  mode: 'single' | 'range' | 'multiple' = 'single',
  calendarMode?: 'static',
  locale?: string,
  showPreviousMonth?: boolean,
) => {
  let offsets: number[] | undefined;
  if (mode === 'range') {
    offsets = showPreviousMonth ? [-1] : [1];
  }

  const config: React.ComponentProps<typeof DatePickerProvider>['config'] = {
    selectedDates,
    onDatesChange: handleDatesChange,
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

const SINGLE_PANEL_PROPS = { w: 300, minWidth: 300 } as const;

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

  const config = useMemo(
    () =>
      createPickerConfig(
        selectedDates,
        handleDatesChange,
        minDate,
        maxDate,
        'single',
        undefined,
        locale,
      ),
    [selectedDates, handleDatesChange, minDate, maxDate, locale],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={{ ...SINGLE_PANEL_PROPS, ...floatingPanelProps }}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'date',
        placeholder,
        disabled,
        onClear: () => onChange?.(null),
      })}
      renderContent={
        <YStack padding="$3" minWidth={280}>
          <DatePickerProvider config={config}>
            <Calendar mode="date" />
          </DatePickerProvider>
        </YStack>
      }
    />
  );
}

function RangePickerContent({
  config,
  minDate,
  maxDate,
  showPreviousMonth,
  presets,
  value,
  onChange,
  close,
}: {
  config: React.ComponentProps<typeof DatePickerProvider>['config'];
  minDate?: Date;
  maxDate?: Date;
  showPreviousMonth?: boolean;
  presets?: IDateRangePreset[];
  value?: IDateRange;
  onChange?: (range: IDateRange) => void;
  close: () => void;
}) {
  const media = useMedia();
  const hasPresets = presets && presets.length > 0 && media.gtMd;

  const handlePresetSelect = useCallback(
    (range: IDateRange) => {
      onChange?.(range);
      close();
    },
    [onChange, close],
  );

  return (
    <XStack>
      {hasPresets ? (
        <PresetsSidebar
          presets={presets}
          value={value}
          onSelect={handlePresetSelect}
        />
      ) : null}
      <YStack padding="$3" minWidth={280} flex={1} $gtMd={{ padding: '$4' }}>
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
  const hasPresets = presets && presets.length > 0 && media.gtMd;

  const selectedDates = useMemo(
    () =>
      [value?.start, value?.end].filter((d): d is Date => d instanceof Date),
    [value],
  );

  const handleDatesChange = useCallback(
    (dates: Date[]) => {
      const range: IDateRange = {
        start: dates[0] || null,
        end: dates[1] || null,
      };
      onChange?.(range);
      if (dates.length === 2) {
        close();
      }
    },
    [onChange, close],
  );

  const config = useMemo(
    () =>
      createPickerConfig(
        selectedDates,
        handleDatesChange,
        minDate,
        maxDate,
        'range',
        undefined,
        locale,
        showPreviousMonth,
      ),
    [
      selectedDates,
      handleDatesChange,
      minDate,
      maxDate,
      locale,
      showPreviousMonth,
    ],
  );

  const panelWidth = hasPresets ? 780 : 624;

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={{
        w: panelWidth,
        maxWidth: panelWidth,
        ...floatingPanelProps,
      }}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'range',
        placeholder,
        disabled,
        onClear: () => onChange?.({ start: null, end: null }),
      })}
      renderContent={
        <RangePickerContent
          config={config}
          minDate={minDate}
          maxDate={maxDate}
          showPreviousMonth={showPreviousMonth}
          presets={presets}
          value={value}
          onChange={onChange}
          close={close}
        />
      }
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
      createPickerConfig(
        selectedDates,
        handleDatesChange,
        minDate,
        maxDate,
        'single',
        'static',
        locale,
      ),
    [selectedDates, handleDatesChange, minDate, maxDate, locale],
  );

  const handleYearSelect = useCallback(
    (year: number) => {
      onChange?.(new Date(year, 0, 1));
      close();
    },
    [onChange, close],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={{ ...SINGLE_PANEL_PROPS, ...floatingPanelProps }}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'year',
        placeholder,
        disabled,
        onClear: () => onChange?.(null),
      })}
      renderContent={
        <YStack padding="$3" minWidth={280}>
          <DatePickerProvider config={config}>
            <Calendar mode="year" onYearSelect={handleYearSelect} />
          </DatePickerProvider>
        </YStack>
      }
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
      createPickerConfig(
        selectedDates,
        handleDatesChange,
        minDate,
        maxDate,
        'single',
        'static',
        locale,
      ),
    [selectedDates, handleDatesChange, minDate, maxDate, locale],
  );

  const handleMonthSelect = useCallback(
    (date: Date) => {
      onChange?.(new Date(date.getFullYear(), date.getMonth(), 1));
      close();
    },
    [onChange, close],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={{ ...SINGLE_PANEL_PROPS, ...floatingPanelProps }}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'month',
        placeholder,
        disabled,
        onClear: () => onChange?.(null),
      })}
      renderContent={
        <YStack padding="$3" minWidth={280}>
          <DatePickerProvider config={config}>
            <Calendar mode="month" onMonthSelect={handleMonthSelect} />
          </DatePickerProvider>
        </YStack>
      }
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

  const config = useMemo(
    () =>
      createPickerConfig(
        value,
        handleDatesChange,
        minDate,
        maxDate,
        'multiple',
        undefined,
        locale,
      ),
    [value, handleDatesChange, minDate, maxDate, locale],
  );

  return (
    <PickerPopover
      title={title}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      floatingPanelProps={{ ...SINGLE_PANEL_PROPS, ...floatingPanelProps }}
      sheetProps={sheetProps}
      renderTrigger={renderPickerTrigger({
        renderTrigger,
        value,
        mode: 'multiple',
        placeholder,
        disabled,
        onClear: () => onChange?.([]),
      })}
      renderContent={
        <YStack padding="$3" minWidth={280}>
          <DatePickerProvider config={config}>
            <Calendar mode="multiple" />
          </DatePickerProvider>
        </YStack>
      }
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
