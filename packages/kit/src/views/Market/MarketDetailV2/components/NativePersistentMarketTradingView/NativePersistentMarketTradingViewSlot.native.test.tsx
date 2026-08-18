/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { render } from '@testing-library/react';

import {
  getNativeMarketTradingViewHostSnapshot,
  resetNativeMarketTradingViewHostForTest,
} from './nativeMarketTradingViewHostStore';
import { NativePersistentMarketTradingViewSlot } from './NativePersistentMarketTradingViewSlot.native';

const mockScrollY = { value: 0 };
const mockApplyChartPriceUpdate = jest.fn();

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockView = React.forwardRef<
    {
      measureInWindow: (
        callback: (x: number, y: number, width: number, height: number) => void,
      ) => void;
    },
    PropsWithChildren<{ onLayout?: () => void }>
  >(({ children, onLayout }, ref) => {
    React.useImperativeHandle(
      ref,
      () => ({
        measureInWindow: (callback) => callback(0, 120, 390, 400),
      }),
      [],
    );
    React.useEffect(() => {
      onLayout?.();
    }, [onLayout]);
    return React.createElement(React.Fragment, null, children);
  });
  MockView.displayName = 'MockView';
  return { View: MockView };
});

jest.mock('react-native-screens', () => ({
  useTransitionProgress: () => ({ progress: undefined }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    CollapsibleTabContext: React.createContext({
      contentInset: 0,
      focusedTab: { value: 'chart' },
      refMap: {},
      scrollYCurrent: { value: 0 },
    }),
    useCurrentTabScrollY: () => mockScrollY,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: { applyChartPriceUpdate: mockApplyChartPriceUpdate },
  }),
}));

jest.mock('../InformationTabs/hooks/useNetworkAccountAddress', () => ({
  useNetworkAccountAddress: () => ({ accountAddress: '0xaccount' }),
}));

describe('NativePersistentMarketTradingViewSlot', () => {
  beforeEach(() => {
    resetNativeMarketTradingViewHostForTest();
    mockApplyChartPriceUpdate.mockClear();
    mockScrollY.value = 0;
  });

  it('does not forward chart touch scrolling to the persistent host', () => {
    const onTouchScroll = jest.fn();
    const scrollGestureProps = {
      panActiveOffsetY: [-4, 4] as [number, number],
      panFailOffsetX: [-40, 40] as [number, number],
      simultaneousWithNativeGesture: true,
    };
    const { unmount } = render(
      <NativePersistentMarketTradingViewSlot
        clipTop={96}
        isChartPageVisible
        scrollGestureProps={scrollGestureProps}
        tradingViewProps={{
          tokenAddress: '0xtoken',
          networkId: 'evm--1',
          tokenSymbol: 'ONE',
          onTouchScroll,
        }}
      />,
    );

    expect(
      getNativeMarketTradingViewHostSnapshot().activeSession?.props
        .onTouchScroll,
    ).toBeUndefined();
    expect(onTouchScroll).not.toHaveBeenCalled();
    expect(
      getNativeMarketTradingViewHostSnapshot().activeSession,
    ).toMatchObject({
      scrollGestureProps,
      tabsContext: {
        contentInset: 0,
        focusedTab: { value: 'chart' },
        refMap: {},
        scrollYCurrent: { value: 0 },
      },
    });

    unmount();
  });
});
