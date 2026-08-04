/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';

import {
  activateNativeMarketTradingViewSession,
  createNativeMarketTradingViewSessionId,
  deactivateNativeMarketTradingViewSession,
  requestNativeMarketTradingViewWarmup,
  resetNativeMarketTradingViewHostForTest,
} from './nativeMarketTradingViewHostStore';
import { NativePersistentMarketTradingViewHost } from './NativePersistentMarketTradingViewHost.native';

import type { INativeMarketTradingViewSession } from './nativeMarketTradingViewHostStore';
import type { Animated as NativeAnimated } from 'react-native';

const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockChartProps = jest.fn();
const mockEventListeners = new Map<string, () => void>();

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockAnimatedView = React.forwardRef<
    { measureInWindow: (callback: (x: number, y: number) => void) => void },
    PropsWithChildren<{ onLayout?: () => void }>
  >(({ children, onLayout }, ref) => {
    React.useImperativeHandle(
      ref,
      () => ({
        measureInWindow: (callback: (x: number, y: number) => void) =>
          callback(0, 0),
      }),
      [],
    );
    React.useEffect(() => {
      onLayout?.();
    }, [onLayout]);
    return React.createElement(React.Fragment, null, children);
  });
  MockAnimatedView.displayName = 'MockAnimatedView';
  return {
    Animated: {
      View: MockAnimatedView,
    },
    Dimensions: {
      get: () => ({ height: 844, width: 390 }),
    },
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
  };
});

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      View: ({ children }: PropsWithChildren) =>
        React.createElement('div', null, children),
    },
    Easing: {
      cubic: 'cubic',
      out: (easing: unknown) => easing,
    },
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (value: number) => ({ value }),
    withDelay: (_delay: number, animation: unknown) => animation,
    withTiming: (value: number) => value,
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: PropsWithChildren) => children,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { marketWatchListV2: 'marketWatchListV2' },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { MemoryPressureWarning: 'MemoryPressureWarning' },
  appEventBus: {
    on: jest.fn((eventName: string, listener: () => void) => {
      mockEventListeners.set(eventName, listener);
    }),
    off: jest.fn((eventName: string) => {
      mockEventListeners.delete(eventName);
    }),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));

jest.mock('@onekeyhq/shared/types', () => ({
  EAccountSelectorSceneName: { home: 'home' },
}));

jest.mock('../../../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: ({ children }: PropsWithChildren) =>
    children,
}));

jest.mock('../../utils/nativeMarketTradingViewPreloadPolicy', () => ({
  getNativeMarketTradingViewPreloadPolicy: () => ({
    enabled: true,
    delayMs: 0,
  }),
}));

jest.mock('../../utils/marketTradingViewResolutionPreference', () => ({
  hydrateMarketTradingViewPreferences: jest.fn(() => Promise.resolve()),
}));

jest.mock('../MarketTradingView/MarketTradingView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    MarketTradingViewView: ({
      isActive,
      isVisibilityManagedExternally,
      tokenSymbol,
    }: {
      isActive?: boolean;
      isVisibilityManagedExternally?: boolean;
      tokenSymbol?: string;
    }) => {
      mockChartProps({
        isActive,
        isVisibilityManagedExternally,
        tokenSymbol,
      });
      React.useEffect(() => {
        mockChartMount();
        return () => {
          mockChartUnmount();
        };
      }, []);
      return React.createElement(
        'div',
        {
          'data-testid': 'persistent-chart',
          'data-active': String(Boolean(isActive)),
        },
        tokenSymbol,
      );
    },
  };
});

describe('NativePersistentMarketTradingViewHost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetNativeMarketTradingViewHostForTest();
    mockChartMount.mockClear();
    mockChartUnmount.mockClear();
    mockChartProps.mockClear();
    mockEventListeners.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the same chart component mounted across detail sessions', async () => {
    render(<NativePersistentMarketTradingViewHost />);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      requestNativeMarketTradingViewWarmup();
    });
    expect(screen.getByTestId('persistent-chart').textContent).toBe(
      'ONEKEY_PREWARM',
    );
    expect(screen.getByTestId('persistent-chart').dataset.active).toBe('false');
    expect(mockChartMount).toHaveBeenCalledTimes(1);

    const firstSessionId = createNativeMarketTradingViewSessionId();
    act(() => {
      activateNativeMarketTradingViewSession({
        id: firstSessionId,
        scrollY: {
          value: 0,
        } as INativeMarketTradingViewSession['scrollY'],
        props: {
          tokenAddress: '0x1',
          networkId: 'evm--1',
          tokenSymbol: 'ONE',
        },
      });
    });
    expect(screen.getByTestId('persistent-chart').textContent).toBe('ONE');
    expect(screen.getByTestId('persistent-chart').dataset.active).toBe('true');
    expect(mockChartProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ isVisibilityManagedExternally: true }),
    );

    act(() => {
      deactivateNativeMarketTradingViewSession(firstSessionId);
    });
    expect(screen.getByTestId('persistent-chart').dataset.active).toBe('false');
    const secondSessionId = createNativeMarketTradingViewSessionId();
    act(() => {
      activateNativeMarketTradingViewSession({
        id: secondSessionId,
        scrollY: {
          value: 0,
        } as INativeMarketTradingViewSession['scrollY'],
        props: {
          tokenAddress: '0x2',
          networkId: 'evm--1',
          tokenSymbol: 'TWO',
        },
      });
    });

    expect(screen.getByTestId('persistent-chart').textContent).toBe('TWO');
    expect(mockChartMount).toHaveBeenCalledTimes(1);
    expect(mockChartUnmount).not.toHaveBeenCalled();
  });

  it('warms the persistent chart after app startup', async () => {
    render(<NativePersistentMarketTradingViewHost />);

    expect(screen.queryByTestId('persistent-chart')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(screen.getByTestId('persistent-chart').textContent).toBe(
      'ONEKEY_PREWARM',
    );
    expect(mockChartMount).toHaveBeenCalledTimes(1);
  });

  it('uses the native stack progress for the chart slide transition', async () => {
    const interpolate = jest.fn(() => 0);
    render(<NativePersistentMarketTradingViewHost />);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      activateNativeMarketTradingViewSession({
        id: createNativeMarketTradingViewSessionId(),
        frame: {
          anchorX: 0,
          anchorY: 200,
          width: 390,
          height: 400,
          clipTop: 0,
        },
        scrollY: {
          value: 0,
        } as INativeMarketTradingViewSession['scrollY'],
        transitionProgress: {
          interpolate,
        } as unknown as NativeAnimated.Value,
        props: {
          tokenAddress: '0x1',
          networkId: 'evm--1',
          tokenSymbol: 'ONE',
        },
      });
    });

    expect(interpolate).toHaveBeenCalledWith({
      inputRange: [0, 1],
      outputRange: [390, 0],
      extrapolate: 'clamp',
    });
  });
});
