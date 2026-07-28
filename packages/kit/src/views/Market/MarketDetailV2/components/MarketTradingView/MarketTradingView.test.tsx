/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { MarketTestIDs } from '../../../testIDs';

jest.doMock('../../../../../../../../__mocks__/componentsMock', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Empty: ({
      buttonProps,
      testID,
    }: {
      buttonProps?: {
        children?: React.ReactNode;
        onPress?: () => void;
        testID?: string;
      };
      testID?: string;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': testID },
        buttonProps
          ? React.createElement(
              'button',
              {
                type: 'button',
                'data-testid': buttonProps.testID,
                onClick: buttonProps.onPress,
              },
              buttonProps.children,
            )
          : null,
      ),
    Skeleton: () =>
      React.createElement('span', { 'data-testid': 'chart-skeleton' }),
    Stack: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => React.createElement('div', { 'data-testid': testID }, children),
  };
});

const mockTradingViewProps: Record<string, unknown>[] = [];
let mockTradingViewMountCount = 0;
const mockHydrateMarketTradingViewPreferences = jest.fn(() =>
  Promise.resolve(),
);
const mockIsMarketTradingViewPreferencesHydrated = jest.fn(() => true);
const mockPlatformEnv = {
  isNative: true,
  isWeb: false,
  isDesktop: false,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components/src/utils/animationConstants', () => ({
  ANIMATE_ONLY_OPACITY: ['opacity'],
}));

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewV2', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TRADING_VIEW_DISABLED_FEATURES: {
      TIMEFRAME_SELECTOR: 'timeframe_selector',
      TIME_SCALE: 'time_scale',
      SETTINGS: 'settings',
      FULLSCREEN: 'fullscreen',
      LAYOUT_TOGGLE: 'layout_toggle',
      DRAWING_TOOLBAR: 'drawing_toolbar',
    },
    TradingViewV2: (props: Record<string, unknown>) => {
      React.useEffect(() => {
        mockTradingViewMountCount += 1;
      }, []);
      mockTradingViewProps.push(props);
      return React.createElement('div', {
        'data-testid': 'market-detail-chart',
      });
    },
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: {
      applyChartPriceUpdate: jest.fn(),
    },
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_network_error: 'global_network_error',
    global_retry: 'global_retry',
    global_unknown_error_retry_message: 'global_unknown_error_retry_message',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  normalizeTokenContractAddress: ({
    contractAddress,
  }: {
    contractAddress?: string;
  }) => contractAddress?.trim().toLowerCase(),
}));

jest.mock('../../utils/marketTradingViewResolutionPreference', () => ({
  getMarketTradingViewSessionPreference: () => ({ resolution: '1m' }),
  hydrateMarketTradingViewPreferences: mockHydrateMarketTradingViewPreferences,
  isMarketTradingViewPreferencesHydrated:
    mockIsMarketTradingViewPreferencesHydrated,
  saveMarketTradingViewFirstScreenRequestPreference: jest.fn(),
  saveMarketTradingViewResolutionPreference: jest.fn(),
  updateMarketTradingViewSessionResolution: jest.fn(),
}));

jest.mock('../InformationTabs/hooks/useNetworkAccountAddress', () => ({
  useNetworkAccountAddress: () => ({ accountAddress: undefined }),
}));

const { MarketTradingView, MarketTradingViewView } = jest.requireActual<
  typeof import('./MarketTradingView')
>('./MarketTradingView');

describe('MarketTradingViewView readiness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockTradingViewProps.length = 0;
    mockTradingViewMountCount = 0;
    mockHydrateMarketTradingViewPreferences.mockReset();
    mockHydrateMarketTradingViewPreferences.mockResolvedValue(undefined);
    mockIsMarketTradingViewPreferencesHydrated.mockReset();
    mockIsMarketTradingViewPreferencesHydrated.mockReturnValue(true);
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isWeb = false;
    mockPlatformEnv.isDesktop = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the loading cover until the current K-line first paint', () => {
    const { unmount } = render(
      <MarketTradingViewView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    const tradingViewProps = mockTradingViewProps.at(-1);
    expect(tradingViewProps?.onChartReady).toBeUndefined();
    expect(screen.getByTestId(MarketTestIDs.detailChartLoading)).toBeTruthy();

    act(() => {
      (
        tradingViewProps?.onFirstPaintReady as
          | ((data: Record<string, unknown>) => void)
          | undefined
      )?.({
        requestId: 'request-1',
        resolution: '1m',
        firstDataRequest: true,
        status: 'rendered',
        returnedCount: 100,
        source: 'bootstrap',
        tokenAddress: '0xabc',
        networkId: 'evm--1',
      });
    });

    expect(screen.queryByTestId(MarketTestIDs.detailChartLoading)).toBeNull();
    unmount();
  });

  it('does not cover the chart with a loading overlay on web', () => {
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isWeb = true;

    render(
      <MarketTradingViewView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    expect(screen.getByTestId(MarketTestIDs.detailChart)).toBeTruthy();
    expect(screen.queryByTestId(MarketTestIDs.detailChartLoading)).toBeNull();
  });

  it('does not cover the chart with a loading overlay on desktop', () => {
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isDesktop = true;

    render(
      <MarketTradingViewView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    expect(screen.getByTestId(MarketTestIDs.detailChart)).toBeTruthy();
    expect(screen.queryByTestId(MarketTestIDs.detailChartLoading)).toBeNull();
  });

  it('does not treat a readiness timeout as a successful first paint', () => {
    const { unmount } = render(
      <MarketTradingViewView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    expect(screen.getByTestId(MarketTestIDs.detailChartLoading)).toBeTruthy();
    unmount();
  });

  it('shows a retry state after failure and accepts a later successful paint', () => {
    render(
      <MarketTradingViewView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    const tradingViewProps = mockTradingViewProps.at(-1);
    const onFirstPaintReady = tradingViewProps?.onFirstPaintReady as
      | ((data: Record<string, unknown>) => void)
      | undefined;

    act(() => {
      onFirstPaintReady?.({
        requestId: 'request-failed',
        resolution: '1m',
        firstDataRequest: true,
        status: 'failed',
        returnedCount: 0,
        source: 'bridge',
        tokenAddress: '0xabc',
        networkId: 'evm--1',
      });
    });

    expect(screen.getByTestId(MarketTestIDs.detailChartError)).toBeTruthy();
    expect(screen.queryByTestId(MarketTestIDs.detailChartLoading)).toBeNull();

    act(() => {
      onFirstPaintReady?.({
        requestId: 'request-success',
        resolution: '1m',
        firstDataRequest: true,
        status: 'rendered',
        returnedCount: 100,
        source: 'bridge',
        tokenAddress: '0xabc',
        networkId: 'evm--1',
      });
    });

    expect(screen.queryByTestId(MarketTestIDs.detailChartError)).toBeNull();
    expect(screen.queryByTestId(MarketTestIDs.detailChartLoading)).toBeNull();
  });

  it('returns to loading while retrying a failed chart', () => {
    render(
      <MarketTradingViewView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    act(() => {
      (
        mockTradingViewProps.at(-1)?.onFirstPaintReady as
          | ((data: Record<string, unknown>) => void)
          | undefined
      )?.({
        requestId: 'request-failed',
        resolution: '1m',
        firstDataRequest: true,
        status: 'failed',
        returnedCount: 0,
        source: 'bridge',
      });
    });

    fireEvent.click(screen.getByTestId(MarketTestIDs.detailChartRetry));

    expect(screen.queryByTestId(MarketTestIDs.detailChartError)).toBeNull();
    expect(screen.getByTestId(MarketTestIDs.detailChartLoading)).toBeTruthy();
    expect(mockTradingViewMountCount).toBe(2);
  });

  it('keeps the chart instance mounted when the token changes', () => {
    const { rerender } = render(
      <MarketTradingViewView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    rerender(
      <MarketTradingViewView
        tokenAddress="0xdef"
        networkId="evm--1"
        tokenSymbol="DEF"
      />,
    );

    expect(mockTradingViewMountCount).toBe(1);
  });

  it('waits for persisted preferences before mounting the chart', async () => {
    let resolveHydration: (() => void) | undefined;
    mockIsMarketTradingViewPreferencesHydrated.mockReturnValue(false);
    mockHydrateMarketTradingViewPreferences.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveHydration = resolve;
      }),
    );

    render(
      <MarketTradingView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    expect(mockTradingViewProps).toHaveLength(0);
    expect(screen.getByTestId(MarketTestIDs.detailChartLoading)).toBeTruthy();

    await act(async () => {
      resolveHydration?.();
      await Promise.resolve();
    });

    expect(mockTradingViewProps).toHaveLength(1);
  });

  it('does not show the preferences loading overlay on web', () => {
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isWeb = true;
    mockIsMarketTradingViewPreferencesHydrated.mockReturnValue(false);
    mockHydrateMarketTradingViewPreferences.mockReturnValueOnce(
      new Promise<void>(() => undefined),
    );

    render(
      <MarketTradingView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    expect(mockTradingViewProps).toHaveLength(0);
    expect(screen.queryByTestId(MarketTestIDs.detailChartLoading)).toBeNull();
  });

  it('does not show the preferences loading overlay on desktop', () => {
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isDesktop = true;
    mockIsMarketTradingViewPreferencesHydrated.mockReturnValue(false);
    mockHydrateMarketTradingViewPreferences.mockReturnValueOnce(
      new Promise<void>(() => undefined),
    );

    render(
      <MarketTradingView
        tokenAddress="0xabc"
        networkId="evm--1"
        tokenSymbol="ABC"
      />,
    );

    expect(mockTradingViewProps).toHaveLength(0);
    expect(screen.queryByTestId(MarketTestIDs.detailChartLoading)).toBeNull();
  });
});
