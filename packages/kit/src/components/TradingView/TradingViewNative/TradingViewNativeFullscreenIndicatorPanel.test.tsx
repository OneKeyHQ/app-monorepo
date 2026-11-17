/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';

import { createTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsAdapter';
import {
  TradingViewNativeFullscreenIndicatorPanel,
  getTradingViewNativeFullscreenIndicatorPanelWidth,
} from './TradingViewNativeFullscreenIndicatorPanel';

import type { ITradingViewNativeAnyIndicator } from './utils/chartIndicators';
import type { ITradingViewIndicatorOption } from '../TradingViewChartControls/types';

let mockBackHandler: (() => boolean) | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 844, height: 390 }),
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
  Easing: {
    cubic: (value: number) => value,
    in: (easing: (value: number) => number) => easing,
    out: (easing: (value: number) => number) => easing,
  },
  runOnJS:
    <T extends unknown[]>(fn: (...args: T) => void) =>
    (...args: T) =>
      fn(...args),
  useAnimatedStyle: (updater: () => Record<string, unknown>) => updater(),
  useSharedValue: <T,>(value: T) => ({ value }),
  withTiming: <T,>(
    value: T,
    _config: unknown,
    callback?: (finished: boolean) => void,
  ) => {
    callback?.(true);
    return value;
  },
}));

type IMockProps = {
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};

jest.mock('@onekeyhq/components', () => {
  const View = ({
    children,
    testID,
    onPress,
    accessibilityState,
    accessibilityLabel,
  }: IMockProps) =>
    onPress || accessibilityState ? (
      <button
        type="button"
        data-testid={testID}
        aria-label={accessibilityLabel}
        aria-pressed={accessibilityState?.selected}
        disabled={accessibilityState?.disabled}
        onClick={onPress}
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  const Button = ({
    children,
    testID,
    onPress,
    disabled,
    loading,
    accessibilityLabel,
  }: IMockProps) => (
    <button
      type="button"
      data-testid={testID}
      aria-label={accessibilityLabel}
      disabled={disabled || loading}
      onClick={onPress}
    >
      {children}
    </button>
  );
  return {
    Button,
    IconButton: Button,
    Icon: () => null,
    ScrollView: View,
    SizableText: ({ children }: IMockProps) => <span>{children}</span>,
    Stack: View,
    XStack: View,
    YStack: View,
    Divider: () => null,
    Keyboard: { dismiss: jest.fn() },
    Toast: { error: jest.fn() },
    Checkbox: () => null,
    ColorPicker: () => null,
    SegmentSlider: () => null,
    NumberInput: ({
      value,
      onChangeText,
      testID,
    }: {
      value: string;
      onChangeText: (value: string) => void;
      testID: string;
    }) => (
      <input
        data-testid={testID}
        value={value}
        onChange={(event) => onChangeText(event.target.value)}
      />
    ),
    useBackHandler: (callback: () => boolean) => {
      mockBackHandler = callback;
    },
  };
});

const PANEL = 'trading-view-native-fullscreen-indicator-panel';
const MAIN_INDICATORS: ITradingViewIndicatorOption[] = [
  { label: 'MA', value: 'MA' },
  { label: 'EMA', value: 'EMA' },
  { label: 'BOLL', value: 'BOLL' },
  { label: 'SAR', value: 'SAR' },
  { label: 'VWAP', value: 'VWAP' },
];
const SUB_INDICATORS: ITradingViewIndicatorOption[] = [
  { label: 'VOL', value: 'VOL' },
  { label: 'MACD', value: 'MACD' },
  { label: 'RSI', value: 'RSI' },
];

function renderPanel({
  initialIndicatorId,
  activeIndicatorValues = new Set(['MA', 'VOL']),
  canToggleIndicatorOn = () => true,
  onIndicatorToggle = jest.fn(),
  onSave = jest.fn(),
  onClose = jest.fn(),
}: {
  initialIndicatorId?: ITradingViewNativeAnyIndicator;
  activeIndicatorValues?: ReadonlySet<string>;
  canToggleIndicatorOn?: (indicatorValue: string) => boolean;
  onIndicatorToggle?: jest.Mock;
  onSave?: jest.Mock;
  onClose?: jest.Mock;
} = {}) {
  render(
    <TradingViewNativeFullscreenIndicatorPanel
      initialIndicatorId={initialIndicatorId}
      mainIndicators={MAIN_INDICATORS}
      subIndicators={SUB_INDICATORS}
      activeIndicatorValues={activeIndicatorValues}
      canToggleIndicatorOn={canToggleIndicatorOn}
      onIndicatorToggle={onIndicatorToggle}
      value={createTradingViewNativeIndicatorSettingsValue()}
      defaultValue={createTradingViewNativeIndicatorSettingsValue()}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onIndicatorToggle, onSave, onClose };
}

function pressHardwareBack() {
  let handled: boolean | undefined;
  act(() => {
    handled = mockBackHandler?.();
  });
  return handled;
}

describe('TradingViewNativeFullscreenIndicatorPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBackHandler = undefined;
  });

  it.each([
    [640, 371.2],
    [667, 386.86],
    [844, 480],
    [568, 360],
    [320, 320],
  ])('sizes the panel for a %ipt window', (windowWidth, expected) => {
    expect(
      getTradingViewNativeFullscreenIndicatorPanelWidth(windowWidth),
    ).toBeCloseTo(expected);
  });

  it('toggles indicators from main and sub chips', () => {
    const { onIndicatorToggle } = renderPanel({
      canToggleIndicatorOn: (value) => value !== 'RSI',
    });
    expect(screen.getByTestId(`${PANEL}-indicators`)).toBeTruthy();
    expect(screen.queryByTestId(`${PANEL}-back`)).toBeNull();
    const chip = (value: string) =>
      screen.getByTestId(`${PANEL}-chip-${value}`);
    expect(chip('MA').getAttribute('aria-pressed')).toBe('true');
    expect(chip('EMA').getAttribute('aria-pressed')).toBe('false');
    expect(chip('VOL').getAttribute('aria-pressed')).toBe('true');
    expect(chip('RSI').hasAttribute('disabled')).toBe(true);

    fireEvent.click(chip('EMA'));
    fireEvent.click(chip('VOL'));
    fireEvent.click(chip('RSI'));
    expect(onIndicatorToggle.mock.calls).toEqual([
      [{ label: 'EMA', value: 'EMA' }],
      [{ label: 'VOL', value: 'VOL' }],
    ]);
  });

  it('edits parameters from the settings entry and steps back on hardware back', async () => {
    const { onSave, onClose } = renderPanel();
    fireEvent.click(screen.getByTestId(`${PANEL}-settings-trigger`));
    expect(screen.getByTestId(`${PANEL}-settings`)).toBeTruthy();

    fireEvent.click(
      screen.getByTestId('trading-view-mobile-indicator-settings-MA'),
    );
    expect(screen.getByTestId(`${PANEL}-editor-MA`)).toBeTruthy();
    fireEvent.change(
      screen.getByTestId('mobile-indicator-number-line:line:0'),
      { target: { value: '27' } },
    );
    fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    await waitFor(() =>
      expect(screen.getByTestId(`${PANEL}-settings`)).toBeTruthy(),
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'MA',
        lines: expect.arrayContaining([
          expect.objectContaining({ id: 'line:0', period: 27 }),
        ]),
      }),
    );

    expect(pressHardwareBack()).toBe(true);
    expect(screen.getByTestId(`${PANEL}-indicators`)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    expect(pressHardwareBack()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes after saving an indicator opened directly from the chart', async () => {
    const pending = createPromiseTarget<void>();
    const onSave = jest.fn(() => pending.ready);
    const { onClose } = renderPanel({ initialIndicatorId: 'RSI', onSave });
    expect(screen.getByTestId(`${PANEL}-editor-RSI`)).toBeTruthy();
    expect(screen.queryByTestId(`${PANEL}-back`)).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolveTarget(undefined);
      await pending.ready;
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes once from the backdrop', () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByTestId(`${PANEL}-backdrop`));
    fireEvent.click(screen.getByTestId(`${PANEL}-backdrop`));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
