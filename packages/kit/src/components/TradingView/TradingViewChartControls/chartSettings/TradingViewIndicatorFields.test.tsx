/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  TradingViewIndicatorLineRow,
  TradingViewIndicatorOpacitySlider,
} from './TradingViewIndicatorFields';
import { createTradingViewIndicatorSettingsValue } from './TradingViewSettingsMockState';

type IMockProps = { children?: ReactNode; testID?: string };

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const View = ({ children, testID }: IMockProps) => (
    <div data-testid={testID}>{children}</div>
  );

  return {
    ColorPicker: () => null,
    Icon: () => null,
    NumberInput: ({
      showControls,
      onStep,
      onBlur,
      onChangeText,
      testID,
      value,
    }: {
      showControls?: boolean;
      onStep?: (direction: -1 | 1) => void;
      onBlur?: () => void;
      onChangeText?: (text: string) => void;
      testID?: string;
      value?: string;
    }) => (
      <div>
        <input
          data-testid={testID}
          value={value}
          onBlur={() => onBlur?.()}
          onChange={(event) => onChangeText?.(event.target.value)}
        />
        {showControls ? (
          <>
            <button
              data-testid={`${testID}-decrement`}
              onClick={() => onStep?.(-1)}
              type="button"
            >
              −
            </button>
            <button
              data-testid={`${testID}-increment`}
              onClick={() => onStep?.(1)}
              type="button"
            >
              +
            </button>
          </>
        ) : null}
      </div>
    ),
    SizableText: View,
    SegmentSlider: ({
      onChange,
      snapTapToSegment,
      value,
    }: {
      onChange?: (value: number) => void;
      snapTapToSegment?: boolean;
      value?: number;
    }) => (
      <input
        aria-label="opacity"
        data-snap-tap-to-segment={snapTapToSegment ? 'true' : 'false'}
        type="range"
        value={value}
        onChange={(event) => onChange?.(Number(event.target.value))}
      />
    ),
    Stack: View,
    XStack: View,
    YStack: View,
    useThemeName: () => 'light',
  };
});

jest.mock('./TradingViewSettingsPrimitives', () => {
  const Row = ({ children, label }: IMockProps & { label?: string }) => (
    <div>
      <span>{label}</span>
      {children}
    </div>
  );

  return {
    SettingsCheckboxRow: Row,
    SettingsColorField: () => null,
    SettingsColorPicker: () => null,
    SettingsLineStylePreview: () => null,
    SettingsRow: Row,
    SettingsSelect: ({
      testID,
      value,
      options,
      onChange,
    }: {
      testID: string;
      value: string;
      options: readonly string[];
      onChange: (value: string) => void;
    }) => (
      <select
        data-testid={testID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ),
  };
});

jest.mock('./TradingViewSettingsThemeColors', () => ({
  resolveTradingViewSettingsThemeColor: (value: string) => value,
  useTradingViewSettingsThemeColors: () => ({}),
}));

function getFirstLine() {
  const value = createTradingViewIndicatorSettingsValue();
  const indicator = value.indicators.find((item) =>
    item.lines.some((line) => line.showPeriod !== false),
  );
  const line = indicator?.lines.find((item) => item.showPeriod !== false);
  if (!line) {
    throw new OneKeyLocalError('expected an indicator line with a period');
  }
  return line;
}

describe('TradingViewIndicatorLineRow', () => {
  it.each([
    ['solid-1', 'solid', 'solid'],
    ['solid-2', 'medium', 'solid'],
    ['solid-3', 'bold', 'solid'],
    ['solid-4', 'extraBold', 'solid'],
    ['dashed-1', 'solid', 'dashed'],
    ['dashed-2', 'medium', 'dashed'],
    ['dashed-3', 'bold', 'dashed'],
    ['dashed-4', 'extraBold', 'dashed'],
  ])(
    'applies both width and pattern when selecting %s',
    (value, width, pattern) => {
      const line = { ...getFirstLine(), showSecondaryStyle: true };
      const onStyleChange = jest.fn();
      const onSecondaryStyleChange = jest.fn();
      render(
        <TradingViewIndicatorLineRow
          line={line}
          onToggleLine={jest.fn()}
          onPeriodChange={jest.fn()}
          onStyleChange={onStyleChange}
          onSecondaryStyleChange={onSecondaryStyleChange}
          onColorChange={jest.fn()}
        />,
      );
      expect(screen.getAllByRole('combobox')).toHaveLength(1);
      expect(screen.getAllByRole('option')).toHaveLength(8);
      fireEvent.change(screen.getByRole('combobox'), { target: { value } });
      expect(onStyleChange).toHaveBeenCalledWith(line.id, width);
      expect(onSecondaryStyleChange).toHaveBeenCalledWith(line.id, pattern);
    },
  );

  it('commits a normalized period on blur', () => {
    const line = getFirstLine();
    const handlePeriodChange = jest.fn();

    render(
      <TradingViewIndicatorLineRow
        line={line}
        onToggleLine={jest.fn()}
        onPeriodChange={handlePeriodChange}
        onStyleChange={jest.fn()}
        onSecondaryStyleChange={jest.fn()}
        onColorChange={jest.fn()}
      />,
    );

    const input = screen.getByTestId('trading-view-indicator-number-input');
    fireEvent.change(input, { target: { value: String(line.period + 2.6) } });
    fireEvent.blur(input);

    expect(handlePeriodChange).toHaveBeenCalledWith(line.id, line.period + 3);
  });

  it('steps the period with the NumberInput controls', () => {
    const line = getFirstLine();
    const handlePeriodChange = jest.fn();

    render(
      <TradingViewIndicatorLineRow
        line={line}
        onToggleLine={jest.fn()}
        onPeriodChange={handlePeriodChange}
        onStyleChange={jest.fn()}
        onSecondaryStyleChange={jest.fn()}
        onColorChange={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByTestId('trading-view-indicator-number-input-increment'),
    );
    fireEvent.click(
      screen.getByTestId('trading-view-indicator-number-input-decrement'),
    );

    expect(handlePeriodChange.mock.calls).toEqual([
      [line.id, line.period + 1],
      [line.id, line.period],
    ]);
  });
});

describe('TradingViewIndicatorOpacitySlider', () => {
  it('rounds the slider value before reporting it', () => {
    const handleChange = jest.fn();

    render(
      <TradingViewIndicatorOpacitySlider
        value={40}
        label="Transparency"
        upColor="#00ff00"
        downColor="#ff0000"
        onChange={handleChange}
        onColorChange={jest.fn()}
      />,
    );

    fireEvent.change(
      within(
        screen.getByTestId('trading-view-indicator-opacity-slider'),
      ).getByRole('slider'),
      { target: { value: '42.4' } },
    );

    expect(handleChange).toHaveBeenCalledWith(42);
    expect(
      screen.getByTestId('trading-view-indicator-opacity-value').textContent,
    ).toBe('40%');
  });

  it('snaps taps to the segment marks on every platform', () => {
    render(
      <TradingViewIndicatorOpacitySlider
        value={40}
        label="Transparency"
        upColor="#00ff00"
        downColor="#ff0000"
        onChange={jest.fn()}
        onColorChange={jest.fn()}
      />,
    );

    expect(
      within(screen.getByTestId('trading-view-indicator-opacity-slider'))
        .getByRole('slider')
        .getAttribute('data-snap-tap-to-segment'),
    ).toBe('true');
  });
});
