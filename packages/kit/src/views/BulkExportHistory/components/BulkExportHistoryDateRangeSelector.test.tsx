/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import DefaultBulkExportHistoryDateRangeSelector from './BulkExportHistoryDateRangeSelector';
import NativeBulkExportHistoryDateRangeSelector from './BulkExportHistoryDateRangeSelector.native';

let mockIsNarrow = false;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: () => 'Select date range',
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockSelect({
    disabled,
    items,
    onChange,
    renderTrigger,
    testID,
    title,
    value,
  }: {
    disabled?: boolean;
    items: { disabled?: boolean; label: string; value: string | number }[];
    onChange: (value: string | number) => void;
    renderTrigger: (props: {
      disabled?: boolean;
      label?: string;
      onPress?: () => void;
      value?: string | number;
    }) => ReactNode;
    testID?: string;
    title: string;
    value: string | number;
  }) {
    const [openCount, setOpenCount] = React.useState(0);
    const selectedItem = items.find((item) => item.value === value);
    const handleOpen = () => setOpenCount((count) => count + 1);
    const trigger = renderTrigger({
      disabled,
      label: selectedItem?.label,
      onPress: disabled ? undefined : handleOpen,
      value,
    });
    const resolvedTrigger = React.isValidElement(trigger)
      ? React.cloneElement(
          trigger as ReactElement<{
            disabled?: boolean;
            onPress?: () => void;
          }>,
          {
            disabled,
            onPress: disabled ? undefined : handleOpen,
          },
        )
      : trigger;

    return (
      <div
        data-disabled={disabled}
        data-open-count={openCount}
        data-select-testid={testID}
        data-testid="native-date-range-select"
        data-title={title}
      >
        {resolvedTrigger}
        {openCount > 0
          ? items.map((item) => (
              <button
                key={item.value}
                data-testid={`select-item-${String(item.value)}`}
                disabled={disabled || item.disabled}
                onClick={() => onChange(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))
          : null}
      </div>
    );
  }

  return {
    Button: ({
      children,
      disabled,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        aria-disabled={disabled}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        type="button"
      >
        {children}
      </button>
    ),
    Icon: () => <span aria-hidden="true" />,
    Select: MockSelect,
    SizableText: ({
      children,
      numberOfLines,
    }: {
      children?: ReactNode;
      numberOfLines?: number;
    }) => <span data-number-of-lines={numberOfLines}>{children}</span>,
    SegmentControl: ({
      onChange,
      options: segmentOptions,
      testID,
    }: {
      onChange: (value: string) => void;
      options: { disabled?: boolean }[];
      testID?: string;
    }) => (
      <button
        aria-label="Segment control"
        data-all-options-disabled={segmentOptions.every(
          (option) => option.disabled,
        )}
        data-testid={testID ?? 'segment-control'}
        onClick={() => onChange('custom')}
        type="button"
      />
    ),
    useMedia: () => ({ md: mockIsNarrow }),
  };
});

const options = [
  { label: 'El mes pasado', value: 'lastMonth' },
  { label: 'Últimos 3 meses', value: 'last3Months' },
  { label: 'Personalizado', value: 'custom' },
];

beforeEach(() => {
  mockIsNarrow = false;
});

describe('NativeBulkExportHistoryDateRangeSelector', () => {
  it('shows the complete selected value and all choices in a native select', () => {
    const onChange = jest.fn();
    render(
      <NativeBulkExportHistoryDateRangeSelector
        value="last3Months"
        options={options}
        onChange={onChange}
        testID="date-range"
      />,
    );

    expect(screen.getByTestId('date-range').textContent).toBe(
      'Últimos 3 meses',
    );
    expect(
      screen.getByTestId('date-range').querySelector('[data-number-of-lines]'),
    ).toBeNull();
    expect(
      screen.getByTestId('native-date-range-select').getAttribute('data-title'),
    ).toBe('Select date range');
    expect(
      screen
        .getByTestId('native-date-range-select')
        .getAttribute('data-select-testid'),
    ).toBe('date-range');
    expect(screen.queryByTestId('select-item-lastMonth')).toBeNull();

    fireEvent.click(screen.getByTestId('date-range'));

    expect(
      screen
        .getByTestId('native-date-range-select')
        .getAttribute('data-open-count'),
    ).toBe('1');
    expect(screen.getByTestId('select-item-lastMonth').textContent).toBe(
      'El mes pasado',
    );
    expect(screen.getByTestId('select-item-last3Months').textContent).toBe(
      'Últimos 3 meses',
    );
    expect(screen.getByTestId('select-item-custom').textContent).toBe(
      'Personalizado',
    );

    fireEvent.click(screen.getByTestId('select-item-custom'));

    expect(onChange).toHaveBeenCalledWith('custom');
  });

  it('keeps disabled options non-interactive and exposes their state', () => {
    const onChange = jest.fn();

    render(
      <NativeBulkExportHistoryDateRangeSelector
        value="lastMonth"
        options={options}
        onChange={onChange}
        disabled
        testID="date-range"
      />,
    );

    const trigger = screen.getByTestId('date-range');
    expect(trigger.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(trigger);

    expect(screen.queryByTestId('select-item-custom')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not select an individually disabled native option', () => {
    const onChange = jest.fn();
    render(
      <NativeBulkExportHistoryDateRangeSelector
        value="lastMonth"
        options={options.map((option) =>
          option.value === 'custom' ? { ...option, disabled: true } : option,
        )}
        onChange={onChange}
        testID="date-range"
      />,
    );

    fireEvent.click(screen.getByTestId('date-range'));
    fireEvent.click(screen.getByTestId('select-item-custom'));
    fireEvent.click(screen.getByTestId('select-item-last3Months'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('last3Months');
  });
});

describe('DefaultBulkExportHistoryDateRangeSelector', () => {
  it('uses Select on narrow non-native targets', () => {
    mockIsNarrow = true;
    const onChange = jest.fn();
    render(
      <DefaultBulkExportHistoryDateRangeSelector
        value="last3Months"
        options={options}
        onChange={onChange}
        testID="date-range"
      />,
    );

    expect(screen.queryByLabelText('Segment control')).toBeNull();
    expect(screen.getByTestId('date-range').textContent).toBe(
      'Últimos 3 meses',
    );

    fireEvent.click(screen.getByTestId('date-range'));
    fireEvent.click(screen.getByTestId('select-item-custom'));

    expect(onChange).toHaveBeenCalledWith('custom');
  });

  it('keeps SegmentControl and its disabled state on wide non-native targets', () => {
    const onChange = jest.fn();
    render(
      <DefaultBulkExportHistoryDateRangeSelector
        value="lastMonth"
        options={options}
        onChange={onChange}
        disabled
        testID="date-range"
      />,
    );

    expect(
      screen
        .getByTestId('date-range')
        .getAttribute('data-all-options-disabled'),
    ).toBe('true');

    fireEvent.click(screen.getByTestId('date-range'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not select an individually disabled option', () => {
    const onChange = jest.fn();
    render(
      <DefaultBulkExportHistoryDateRangeSelector
        value="lastMonth"
        options={options.map((option) =>
          option.value === 'custom' ? { ...option, disabled: true } : option,
        )}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Segment control'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
