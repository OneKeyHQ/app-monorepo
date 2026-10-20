/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { TradingViewNativePresentationRotationContext } from '../../TradingViewNative/native/TradingViewNativePresentationContext';

import {
  TradingViewIndicatorLineRow,
  TradingViewIndicatorOpacitySlider,
  TradingViewIndicatorParameterRow,
} from './TradingViewIndicatorFields';
import { createTradingViewIndicatorSettingsValue } from './TradingViewSettingsMockState';

type IMockProps = { children?: ReactNode; testID?: string };
type IMockAddOn = { onPress?: () => void; testID?: string };

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const View = ({ children, testID }: IMockProps) => (
    <div data-testid={testID}>{children}</div>
  );
  const Button = ({
    children,
    testID,
    onPress,
  }: IMockProps & { onPress?: () => void }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  );

  return {
    Button,
    ColorPicker: () => null,
    Icon: () => null,
    IconButton: Button,
    Popover: ({
      open,
      onOpenChange,
      renderTrigger,
      renderContent,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      renderTrigger: ReactElement<{ onPress: () => void }>;
      renderContent: ReactNode;
    }) => (
      <>
        {React.cloneElement(renderTrigger, {
          onPress: () => onOpenChange(true),
        })}
        {open ? (
          <div>
            {renderContent}
            <button
              type="button"
              aria-label="Close keypad"
              onClick={() => onOpenChange(false)}
              data-testid="keypad-close"
            />
          </div>
        ) : null}
      </>
    ),
    Input: ({
      addOns,
      onBlur,
      onChangeText,
      testID,
      value,
    }: {
      addOns?: IMockAddOn[];
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
        {addOns?.map((addOn) => (
          <button
            key={addOn.testID}
            aria-label={addOn.testID}
            data-testid={addOn.testID}
            onClick={() => addOn.onPress?.()}
            type="button"
          />
        ))}
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

jest.mock('@onekeyhq/kit/src/components/NativeAmountKeypad', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit/src/components/NativeAmountKeypad')
  >('@onekeyhq/kit/src/components/NativeAmountKeypad'),
  NativeAmountKeypad: ({
    onKeyPress,
    onBackspaceLongPress,
  }: {
    onKeyPress: (key: string) => void;
    onBackspaceLongPress: () => void;
  }) => (
    <div>
      {['0', '2', '6', '.', 'backspace'].map((key) => (
        <button
          type="button"
          key={key}
          aria-label={key}
          data-testid={`keypad-${key}`}
          onClick={() => onKeyPress(key)}
        />
      ))}
      <button
        type="button"
        aria-label="Clear keypad"
        data-testid="keypad-clear"
        onClick={onBackspaceLongPress}
      />
    </div>
  ),
}));

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
    SettingsRow: Row,
    SettingsSelect: () => null,
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

  it('steps the period with the add-on buttons', () => {
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

  it('edits and normalizes a rotated fullscreen period without a system input', () => {
    const line = getFirstLine();
    const handlePeriodChange = jest.fn();
    const { container } = render(
      <TradingViewNativePresentationRotationContext.Provider value>
        <TradingViewIndicatorLineRow
          line={line}
          onToggleLine={jest.fn()}
          onPeriodChange={handlePeriodChange}
          onStyleChange={jest.fn()}
          onSecondaryStyleChange={jest.fn()}
          onColorChange={jest.fn()}
        />
      </TradingViewNativePresentationRotationContext.Provider>,
    );

    expect(container.querySelector('input')).toBeNull();
    fireEvent.click(screen.getByTestId('trading-view-indicator-number-input'));
    expect(
      screen.queryByTestId('trading-view-indicator-keypad-sign'),
    ).toBeNull();
    for (const key of ['2', '.', '6']) {
      fireEvent.click(screen.getByTestId(`keypad-${key}`));
    }
    expect(
      screen.getByTestId('trading-view-indicator-keypad-value').textContent,
    ).toBe('2.6');
    expect(handlePeriodChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByTestId('trading-view-indicator-keypad-confirm'),
    );
    expect(handlePeriodChange).toHaveBeenCalledWith(line.id, 3);
    expect(
      screen.queryByTestId('trading-view-indicator-keypad-value'),
    ).toBeNull();
  });

  it('discards a dismissed keypad draft and keeps an empty draft valid', () => {
    const line = getFirstLine();
    const handlePeriodChange = jest.fn();
    render(
      <TradingViewNativePresentationRotationContext.Provider value>
        <TradingViewIndicatorLineRow
          line={line}
          onToggleLine={jest.fn()}
          onPeriodChange={handlePeriodChange}
          onStyleChange={jest.fn()}
          onSecondaryStyleChange={jest.fn()}
          onColorChange={jest.fn()}
        />
      </TradingViewNativePresentationRotationContext.Provider>,
    );

    const trigger = screen.getByTestId('trading-view-indicator-number-input');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId('keypad-6'));
    fireEvent.click(screen.getByTestId('keypad-close'));
    expect(handlePeriodChange).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(
      screen.getByTestId('trading-view-indicator-keypad-value').textContent,
    ).toBe(String(line.period));
    fireEvent.click(screen.getByTestId('keypad-clear'));
    fireEvent.click(
      screen.getByTestId('trading-view-indicator-keypad-confirm'),
    );
    expect(handlePeriodChange).not.toHaveBeenCalled();
  });
});

describe('rotated indicator band parameters', () => {
  function renderBand(value = 30, step = 1) {
    const onChange = jest.fn();
    render(
      <TradingViewNativePresentationRotationContext.Provider value>
        <TradingViewIndicatorParameterRow
          parameters={[
            {
              id: 'band:lower',
              label: 'Lower Band',
              value,
              min: Number.NEGATIVE_INFINITY,
              step,
            },
          ]}
          onChange={onChange}
        />
      </TradingViewNativePresentationRotationContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('trading-view-indicator-number-input'));
    return onChange;
  }

  it('commits a negative band value only after confirmation', () => {
    const onChange = renderBand();
    fireEvent.click(screen.getByTestId('keypad-2'));
    fireEvent.click(screen.getByTestId('keypad-6'));
    fireEvent.click(screen.getByTestId('trading-view-indicator-keypad-sign'));
    expect(
      screen.getByTestId('trading-view-indicator-keypad-value').textContent,
    ).toBe('-26');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByTestId('trading-view-indicator-keypad-confirm'),
    );
    expect(onChange).toHaveBeenCalledWith('band:lower', -26);
  });

  it('edits negative decimals and backspaces through the sign', () => {
    const onChange = renderBand(30, 0.1);
    fireEvent.click(screen.getByTestId('keypad-clear'));
    fireEvent.click(screen.getByTestId('trading-view-indicator-keypad-sign'));
    for (const key of ['0', '2', '.', '.', '6']) {
      fireEvent.click(screen.getByTestId(`keypad-${key}`));
    }
    expect(
      screen.getByTestId('trading-view-indicator-keypad-value').textContent,
    ).toBe('-2.6');
    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByTestId('keypad-backspace'));
    }
    expect(
      screen.getByTestId('trading-view-indicator-keypad-value').textContent,
    ).toBe('0');
    fireEvent.click(screen.getByTestId('trading-view-indicator-keypad-sign'));
    for (const key of ['.', '6']) {
      fireEvent.click(screen.getByTestId(`keypad-${key}`));
    }
    expect(
      screen.getByTestId('trading-view-indicator-keypad-value').textContent,
    ).toBe('-0.6');
    fireEvent.click(
      screen.getByTestId('trading-view-indicator-keypad-confirm'),
    );
    expect(onChange).toHaveBeenCalledWith('band:lower', -0.6);
  });

  it('discards a sign change on dismissal and rejects an incomplete sign', () => {
    const onChange = renderBand(-26);
    fireEvent.click(screen.getByTestId('trading-view-indicator-keypad-sign'));
    expect(
      screen.getByTestId('trading-view-indicator-keypad-value').textContent,
    ).toBe('26');
    fireEvent.click(screen.getByTestId('keypad-close'));
    fireEvent.click(screen.getByTestId('trading-view-indicator-number-input'));
    expect(
      screen.getByTestId('trading-view-indicator-keypad-value').textContent,
    ).toBe('-26');
    fireEvent.click(screen.getByTestId('keypad-clear'));
    fireEvent.click(screen.getByTestId('trading-view-indicator-keypad-sign'));
    fireEvent.click(
      screen.getByTestId('trading-view-indicator-keypad-confirm'),
    );
    expect(onChange).not.toHaveBeenCalled();
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
