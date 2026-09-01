/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { getTradingViewNativePriceScaleControlsLayout } from '../utils/priceScaleControls';

import { TradingViewNativePriceScaleControls } from './TradingViewNativePriceScaleControls';

const mockStack = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockXStack = jest.fn<void, [Record<string, unknown>]>();

jest.mock('@onekeyhq/components', () => ({
  SizableText: ({ children }: { children?: ReactNode }) => children,
  Stack: (props: Record<string, unknown>) => mockStack(props),
  XStack: ({ children, ...props }: { children?: ReactNode }) => {
    mockXStack(props);
    return children;
  },
}));

describe('TradingViewNativePriceScaleControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fits and centers two compact buttons inside the main price axis', () => {
    expect(getTradingViewNativePriceScaleControlsLayout(80)).toEqual({
      bottom: 28,
      buttonSize: 28,
      gap: 4,
      right: 10,
      width: 60,
    });
    expect(getTradingViewNativePriceScaleControlsLayout(30)).toBeNull();
    expect(getTradingViewNativePriceScaleControlsLayout(Number.NaN)).toBeNull();
  });

  it('exposes auto and logarithmic controls with their active states', () => {
    const handleAutoScalePress = jest.fn();
    const handleLogScalePress = jest.fn();
    render(
      <TradingViewNativePriceScaleControls
        backgroundColor="#ffffff"
        isAutoScale
        isLogScaleAvailable
        isVisible
        mainChartBottomInset={80}
        onAutoScalePress={handleAutoScalePress}
        onLogScalePress={handleLogScalePress}
        priceAxisWidth={80}
        priceScaleMode="linear"
        testID="market-detail-chart"
      />,
    );

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        testID: 'market-detail-chart-price-scale-controls',
        bottom: 84,
        height: 28,
        opacity: 1,
        pointerEvents: 'auto',
        right: 10,
        width: 60,
      }),
    );
    const autoButtonProps = mockStack.mock.calls[0]?.[0];
    const logButtonProps = mockStack.mock.calls[1]?.[0];
    expect(autoButtonProps).toEqual(
      expect.objectContaining({
        accessibilityState: { selected: true },
        backgroundColor: '$bgInverse',
        height: 28,
        testID: 'market-detail-chart-price-scale-auto',
        width: 28,
      }),
    );
    expect(logButtonProps).toEqual(
      expect.objectContaining({
        accessibilityState: { disabled: false, selected: false },
        backgroundColor: '#ffffff',
        testID: 'market-detail-chart-price-scale-log',
      }),
    );

    (autoButtonProps?.onPress as (() => void) | undefined)?.();
    (logButtonProps?.onPress as (() => void) | undefined)?.();
    expect(handleAutoScalePress).toHaveBeenCalledTimes(1);
    expect(handleLogScalePress).toHaveBeenCalledTimes(1);
  });

  it('marks logarithmic mode as active', () => {
    render(
      <TradingViewNativePriceScaleControls
        backgroundColor="#000000"
        isAutoScale={false}
        isLogScaleAvailable
        isVisible={false}
        mainChartBottomInset={24}
        onAutoScalePress={jest.fn()}
        onLogScalePress={jest.fn()}
        priceAxisWidth={80}
        priceScaleMode="logarithmic"
      />,
    );

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
        opacity: 0,
        pointerEvents: 'none',
      }),
    );
    expect(mockStack.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        accessibilityState: { selected: false },
        backgroundColor: '#000000',
      }),
    );
    expect(mockStack.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        accessibilityState: { disabled: false, selected: true },
        backgroundColor: '$bgInverse',
      }),
    );
  });

  it('disables logarithmic mode when the price range is not positive', () => {
    const handleLogScalePress = jest.fn();
    render(
      <TradingViewNativePriceScaleControls
        backgroundColor="#000000"
        isAutoScale
        isLogScaleAvailable={false}
        isVisible
        mainChartBottomInset={24}
        onAutoScalePress={jest.fn()}
        onLogScalePress={handleLogScalePress}
        priceAxisWidth={80}
        priceScaleMode="linear"
      />,
    );

    expect(mockStack.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        accessibilityState: { disabled: true, selected: false },
        focusable: false,
        onPress: undefined,
        opacity: 0.45,
      }),
    );
  });
});
