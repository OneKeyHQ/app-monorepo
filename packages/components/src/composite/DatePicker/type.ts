import type { ReactElement } from 'react';

import type { IPopoverProps } from '../../actions';
import type { SheetProps } from '../../shared/tamagui';

// eslint-disable-next-line @typescript-eslint/naming-convention
export type DatePickerMode = 'date' | 'range' | 'month' | 'year' | 'multiple';

export interface IDateRange {
  start: Date | null;
  end: Date | null;
}

export interface IDatePickerBaseProps {
  title?: string;
  disabled?: boolean;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  testID?: string;
  renderTrigger?: (props: IDatePickerRenderTriggerProps) => ReactElement;
  floatingPanelProps?: IPopoverProps['floatingPanelProps'];
  sheetProps?: SheetProps;
  onOpenChange?: (isOpen: boolean) => void;
}

export interface IDatePickerRenderTriggerProps {
  value?: Date | Date[] | IDateRange | null;
  mode: DatePickerMode;
  placeholder?: string;
  disabled?: boolean;
  onClear?: () => void;
}

export interface IDatePickerProps extends IDatePickerBaseProps {
  mode?: 'date';
  value?: Date | null;
  onChange?: (date: Date | null) => void;
}

export interface IRangePickerProps extends IDatePickerBaseProps {
  mode?: 'range';
  value?: IDateRange;
  onChange?: (range: IDateRange) => void;
  showPreviousMonth?: boolean;
  presets?: IDateRangePreset[];
}

export interface IYearPickerProps extends IDatePickerBaseProps {
  mode?: 'year';
  value?: Date | null;
  onChange?: (date: Date | null) => void;
}

export interface IMonthPickerProps extends IDatePickerBaseProps {
  mode?: 'month';
  value?: Date | null;
  onChange?: (date: Date | null) => void;
}

export interface IMultiSelectPickerProps extends IDatePickerBaseProps {
  mode?: 'multiple';
  value?: Date[];
  onChange?: (dates: Date[]) => void;
}

export interface IDatePickerTriggerProps {
  value?: Date | Date[] | IDateRange | null;
  mode: DatePickerMode;
  placeholder?: string;
  disabled?: boolean;
  onPress?: () => void;
  onClear?: () => void;
}

export interface IDayCellProps {
  hideOutOfMonth?: boolean;
  fullWidth?: boolean;
  day: {
    day: string;
    date: string;
    active: boolean;
    inCurrentMonth: boolean;
    selected: boolean;
    disabled: boolean;
    range?:
      | 'range-start'
      | 'range-end'
      | 'range-start range-end'
      | 'in-range'
      | 'will-be-in-range'
      | 'will-be-range-start'
      | 'will-be-range-end';
  };
  onPress: (date: string) => void;
}

export interface IDateRangePreset {
  label: string;
  getRange: () => IDateRange;
}

export interface ICalendarHeaderProps {
  month: string;
  year: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onPrevYear?: () => void;
  onNextYear?: () => void;
  onMonthClick?: () => void;
  onYearClick?: () => void;
  mode?: DatePickerMode;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  isPrevYearDisabled?: boolean;
  isNextYearDisabled?: boolean;
}
