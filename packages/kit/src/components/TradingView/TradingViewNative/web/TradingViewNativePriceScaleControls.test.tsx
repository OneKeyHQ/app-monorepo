/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

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

describe('Web TradingViewNativePriceScaleControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders compact controls inside the main price axis only while visible', () => {
    const { rerender } = render(
      <TradingViewNativePriceScaleControls
        backgroundColor="#ffffff"
        isAutoScale
        isLogScaleAvailable
        isVisible={false}
        mainChartBottomInset={80}
        onAutoScalePress={jest.fn()}
        onLogScalePress={jest.fn()}
        priceAxisWidth={80}
        priceScaleMode="linear"
        testID="market-detail-chart"
      />,
    );

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        backgroundColor: '#ffffff',
        'aria-hidden': true,
        bottom: 84,
        height: 20,
        opacity: 0,
        pointerEvents: 'none',
        right: 18.5,
        width: 43,
      }),
    );
    expect(mockStack.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ tabIndex: -1 }),
    );
    expect(mockStack.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ tabIndex: -1 }),
    );

    rerender(
      <TradingViewNativePriceScaleControls
        backgroundColor="#ffffff"
        isAutoScale
        isLogScaleAvailable
        isVisible
        mainChartBottomInset={80}
        onAutoScalePress={jest.fn()}
        onLogScalePress={jest.fn()}
        priceAxisWidth={80}
        priceScaleMode="linear"
        testID="market-detail-chart"
      />,
    );
    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        'aria-hidden': false,
        opacity: 1,
        pointerEvents: 'auto',
      }),
    );
  });

  it('exposes active states and callbacks', () => {
    const handleAutoScalePress = jest.fn();
    const handleLogScalePress = jest.fn();
    render(
      <TradingViewNativePriceScaleControls
        backgroundColor="#ffffff"
        isAutoScale={false}
        isLogScaleAvailable
        isVisible
        mainChartBottomInset={24}
        onAutoScalePress={handleAutoScalePress}
        onLogScalePress={handleLogScalePress}
        priceAxisWidth={80}
        priceScaleMode="logarithmic"
      />,
    );

    const autoButtonProps = mockStack.mock.calls[0]?.[0];
    const logButtonProps = mockStack.mock.calls[1]?.[0];
    expect(autoButtonProps).toEqual(
      expect.objectContaining({
        'aria-pressed': false,
        backgroundColor: '#ffffff',
        height: 20,
        width: 20,
      }),
    );
    expect(logButtonProps).toEqual(
      expect.objectContaining({
        'aria-disabled': false,
        'aria-pressed': true,
        backgroundColor: '$bgInverse',
      }),
    );

    (autoButtonProps?.onPress as (() => void) | undefined)?.();
    (logButtonProps?.onPress as (() => void) | undefined)?.();
    expect(handleAutoScalePress).toHaveBeenCalledTimes(1);
    expect(handleLogScalePress).toHaveBeenCalledTimes(1);
  });

  it('removes unavailable logarithmic mode from keyboard interaction', () => {
    render(
      <TradingViewNativePriceScaleControls
        backgroundColor="#ffffff"
        isAutoScale
        isLogScaleAvailable={false}
        isVisible
        mainChartBottomInset={24}
        onAutoScalePress={jest.fn()}
        onLogScalePress={jest.fn()}
        priceAxisWidth={80}
        priceScaleMode="linear"
      />,
    );

    expect(mockStack.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        'aria-disabled': true,
        onPress: undefined,
        opacity: 0.45,
        tabIndex: -1,
      }),
    );
  });
});
