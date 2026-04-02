import { useState } from 'react';

import { DatePicker, SizableText, YStack } from '@onekeyhq/components';
import type { IDateRange } from '@onekeyhq/components';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { Layout } from './utils/Layout';

function formatDisplayDate(date: Date): string {
  return formatDate(date, { hideTimeForever: true });
}

function DatePickerBasicDemo() {
  const [date, setDate] = useState<Date | null>(new Date());

  return (
    <YStack gap="$4">
      <DatePicker value={date} onChange={setDate} />
      <SizableText size="$bodySm" color="$textSubdued">
        Selected: {date ? formatDisplayDate(date) : 'None'}
      </SizableText>
    </YStack>
  );
}

function DatePickerWithPlaceholderDemo() {
  const [date, setDate] = useState<Date | null>(null);

  return (
    <YStack gap="$4">
      <DatePicker
        value={date}
        onChange={setDate}
        placeholder="Select birthday"
      />
      <SizableText size="$bodySm" color="$textSubdued">
        Selected: {date ? formatDisplayDate(date) : 'None'}
      </SizableText>
    </YStack>
  );
}

function DatePickerDisabledDemo() {
  const [date, setDate] = useState<Date | null>(new Date());

  return (
    <YStack gap="$4">
      <DatePicker value={date} onChange={setDate} disabled />
      <SizableText size="$bodySm" color="$textSubdued">
        Disabled state
      </SizableText>
    </YStack>
  );
}

function DatePickerWithRangeDemo() {
  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const maxDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [date, setDate] = useState<Date | null>(today);

  return (
    <YStack gap="$4">
      <DatePicker
        value={date}
        onChange={setDate}
        minDate={minDate}
        maxDate={maxDate}
        placeholder="Current month only"
      />
      <SizableText size="$bodySm" color="$textSubdued">
        Min: {formatDisplayDate(minDate)} | Max: {formatDisplayDate(maxDate)}
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        Selected: {date ? formatDisplayDate(date) : 'None'}
      </SizableText>
    </YStack>
  );
}

function RangePickerDemo() {
  const [range, setRange] = useState<IDateRange>({
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
  });

  return (
    <YStack gap="$4">
      <DatePicker.Range value={range} onChange={setRange} />
      <SizableText size="$bodySm" color="$textSubdued">
        Start: {range.start ? formatDisplayDate(range.start) : 'None'}
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        End: {range.end ? formatDisplayDate(range.end) : 'None'}
      </SizableText>
    </YStack>
  );
}

function RangePickerEmptyDemo() {
  const [range, setRange] = useState<IDateRange>({
    start: null,
    end: null,
  });

  return (
    <YStack gap="$4">
      <DatePicker.Range
        value={range}
        onChange={setRange}
        placeholder="Select date range"
      />
      <SizableText size="$bodySm" color="$textSubdued">
        Start: {range.start ? formatDisplayDate(range.start) : 'None'}
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        End: {range.end ? formatDisplayDate(range.end) : 'None'}
      </SizableText>
    </YStack>
  );
}

function RangePickerConstrainedDemo() {
  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const maxDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const [range, setRange] = useState<IDateRange>({
    start: null,
    end: null,
  });

  return (
    <YStack gap="$4">
      <DatePicker.Range
        value={range}
        onChange={setRange}
        minDate={minDate}
        maxDate={maxDate}
      />
      <SizableText size="$bodySm" color="$textSubdued">
        Min: {formatDisplayDate(minDate)} | Max: {formatDisplayDate(maxDate)}
      </SizableText>
    </YStack>
  );
}

function YearPickerDemo() {
  const [year, setYear] = useState<Date | null>(new Date());

  return (
    <YStack gap="$4">
      <DatePicker.Year value={year} onChange={setYear} />
      <SizableText size="$bodySm" color="$textSubdued">
        Selected Year: {year ? year.getFullYear() : 'None'}
      </SizableText>
    </YStack>
  );
}

function MonthPickerDemo() {
  const [month, setMonth] = useState<Date | null>(new Date());

  return (
    <YStack gap="$4">
      <DatePicker.Month value={month} onChange={setMonth} />
      <SizableText size="$bodySm" color="$textSubdued">
        Selected Month:{' '}
        {month ? formatDate(month, { formatTemplate: 'yyyy/LL' }) : 'None'}
      </SizableText>
    </YStack>
  );
}

function MultiSelectPickerDemo() {
  const [dates, setDates] = useState<Date[]>([
    new Date(),
    new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // +1 day
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // +2 days
  ]);

  return (
    <YStack gap="$4">
      <DatePicker.MultiSelect value={dates} onChange={setDates} />
      <SizableText size="$bodySm" color="$textSubdued">
        Selected {dates.length} dates:
      </SizableText>
      <YStack gap="$1">
        {dates.map((date, index) => (
          <SizableText key={index} size="$bodySm" color="$textSubdued">
            • {formatDisplayDate(date)}
          </SizableText>
        ))}
      </YStack>
    </YStack>
  );
}

function AllVariantsDemo() {
  const [date, setDate] = useState<Date | null>(new Date());
  const [range, setRange] = useState<IDateRange>({
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  const [year, setYear] = useState<Date | null>(new Date());
  const [month, setMonth] = useState<Date | null>(new Date());

  return (
    <YStack gap="$6">
      <YStack gap="$2">
        <SizableText size="$bodyMd" fontWeight="600">
          Date Picker
        </SizableText>
        <DatePicker value={date} onChange={setDate} />
      </YStack>

      <YStack gap="$2">
        <SizableText size="$bodyMd" fontWeight="600">
          Range Picker
        </SizableText>
        <DatePicker.Range value={range} onChange={setRange} />
      </YStack>

      <YStack gap="$2">
        <SizableText size="$bodyMd" fontWeight="600">
          Year Picker
        </SizableText>
        <DatePicker.Year value={year} onChange={setYear} />
      </YStack>

      <YStack gap="$2">
        <SizableText size="$bodyMd" fontWeight="600">
          Month Picker
        </SizableText>
        <DatePicker.Month value={month} onChange={setMonth} />
      </YStack>
    </YStack>
  );
}

function DatePickerGallery() {
  return (
    <Layout
      componentName="DatePicker"
      description="Date picker component supporting single date selection, date range selection, year selection, month selection, and multi-select mode. Built on @rehookify/datepicker, uses OneKey's Popover component for Web/Desktop floating panels, and automatically switches to bottom Sheet on Native."
      suggestions={[
        'Single date selection for birthdays, deadlines, etc.',
        'Date range selection for filtering time periods, hotel booking, etc.',
        'Year selection for birth year, graduation year, etc.',
        'Month selection for billing month, report month, etc.',
        'Multi-select mode for selecting multiple meeting dates, scheduling, etc.',
        'Use minDate and maxDate to restrict selectable date range',
        'Supports disabled state',
        'Web supports mouse hover preview for range selection',
      ]}
      boundaryConditions={[
        'minDate and maxDate restrict selectable date range',
        'Disabled state prevents opening the picker',
        'Range picker auto-closes after selecting the end date',
        'Year picker displays 12 years at a time',
        'Month picker displays 12 months for the current year',
      ]}
      elements={[
        {
          title: 'Basic Usage',
          element: <DatePickerBasicDemo />,
        },
        {
          title: 'With Placeholder',
          element: <DatePickerWithPlaceholderDemo />,
        },
        {
          title: 'Disabled',
          element: <DatePickerDisabledDemo />,
        },
        {
          title: 'Date Range Constraint',
          element: <DatePickerWithRangeDemo />,
        },
        {
          title: 'Range Picker',
          element: <RangePickerDemo />,
        },
        {
          title: 'Range Picker (Empty)',
          element: <RangePickerEmptyDemo />,
        },
        {
          title: 'Range Picker (Constrained)',
          element: <RangePickerConstrainedDemo />,
        },
        {
          title: 'Year Picker',
          element: <YearPickerDemo />,
        },
        {
          title: 'Month Picker',
          element: <MonthPickerDemo />,
        },
        {
          title: 'Multi-Select',
          element: <MultiSelectPickerDemo />,
        },
        {
          title: 'All Variants',
          element: <AllVariantsDemo />,
        },
      ]}
    />
  );
}

export default DatePickerGallery;
