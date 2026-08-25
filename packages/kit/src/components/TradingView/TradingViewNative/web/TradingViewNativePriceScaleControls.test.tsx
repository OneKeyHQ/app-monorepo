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
        bottom: 84,
        height: 20,
        opacity: 0,
        pointerEvents: 'none',
        right: 18.5,
        width: 43,
      }),
    );

    rerender(
      <TradingViewNativePriceScaleControls
        backgroundColor="#ffffff"
        isAutoScale
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
      expect.objectContaining({ opacity: 1, pointerEvents: 'auto' }),
    );
  });

  it('exposes active states and callbacks', () => {
    const handleAutoScalePress = jest.fn();
    const handleLogScalePress = jest.fn();
    render(
      <TradingViewNativePriceScaleControls
        backgroundColor="#ffffff"
        isAutoScale={false}
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
        'aria-pressed': true,
        backgroundColor: '$bgInverse',
      }),
    );

    (autoButtonProps?.onPress as (() => void) | undefined)?.();
    (logButtonProps?.onPress as (() => void) | undefined)?.();
    expect(handleAutoScalePress).toHaveBeenCalledTimes(1);
    expect(handleLogScalePress).toHaveBeenCalledTimes(1);
  });
});
