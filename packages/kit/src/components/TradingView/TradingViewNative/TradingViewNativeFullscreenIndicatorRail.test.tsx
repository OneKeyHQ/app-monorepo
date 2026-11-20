/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewNativeFullscreenIndicatorRail } from './TradingViewNativeFullscreenIndicatorRail';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

type IMockProps = {
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};

jest.mock('@onekeyhq/components', () => {
  const View = ({
    children,
    testID,
    onPress,
    accessibilityLabel,
    accessibilityState,
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
  return {
    IconButton: View,
    ScrollView: View,
    SizableText: ({ children }: IMockProps) => <span>{children}</span>,
    Stack: View,
    YStack: View,
  };
});

const RAIL = 'trading-view-native-fullscreen-indicator-rail';

describe('TradingViewNativeFullscreenIndicatorRail', () => {
  it('toggles available indicators and opens the panel', () => {
    const onIndicatorPress = jest.fn();
    const onOpenPanel = jest.fn();
    render(
      <TradingViewNativeFullscreenIndicatorRail
        mainIndicators={[
          { label: 'MA', value: 'MA' },
          { label: 'EMA', value: 'EMA' },
        ]}
        subIndicators={[
          { label: 'VOL', value: 'VOL' },
          { label: 'RSI', value: 'RSI' },
        ]}
        activeIndicatorValues={new Set(['MA', 'VOL'])}
        canToggleIndicatorOn={(value) => value !== 'RSI'}
        onIndicatorPress={onIndicatorPress}
        onOpenPanel={onOpenPanel}
      />,
    );
    const item = (value: string) => screen.getByTestId(`${RAIL}-item-${value}`);
    expect(item('MA').getAttribute('aria-pressed')).toBe('true');
    expect(item('EMA').getAttribute('aria-pressed')).toBe('false');
    expect(item('VOL').getAttribute('aria-pressed')).toBe('true');
    expect(item('RSI').hasAttribute('disabled')).toBe(true);

    fireEvent.click(item('EMA'));
    fireEvent.click(item('VOL'));
    fireEvent.click(item('RSI'));
    expect(onIndicatorPress.mock.calls).toEqual([
      [{ label: 'EMA', value: 'EMA' }],
      [{ label: 'VOL', value: 'VOL' }],
    ]);

    fireEvent.click(screen.getByTestId(`${RAIL}-panel-trigger`));
    expect(onOpenPanel).toHaveBeenCalledTimes(1);
  });
});
