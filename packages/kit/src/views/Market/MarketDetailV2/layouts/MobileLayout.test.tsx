/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MobileLayout as LegacyMobileLayout } from './legacyMobileLayout';
import { MobileLayout } from './MobileLayout';

let mockStockDetail: { marketStatus: { isOpen: boolean } } | undefined;
let mockStockDetailError = false;
let mockChartMode: 'simple' | 'pro' = 'simple';
let mockPreferNative = true;
let mockViewportLayout:
  | ((event: { nativeEvent: { layout: { height: number } } }) => void)
  | undefined;
const mockSimpleChart = jest.fn();
const mockNativeChart = jest.fn();
const mockWebViewChart = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Keyboard: { isVisible: () => false },
  useWindowDimensions: () => ({ width: 402, height: 874 }),
}));
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  return { useSharedValue: <T,>(value: T) => useRef({ value }).current };
});
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = ({
    children,
    testID,
    h,
  }: {
    children?: ReactNode;
    testID?: string;
    h?: number | string;
  }) => (
    <div data-testid={testID} data-stack-height={h}>
      {children}
    </div>
  );
  return {
    Stack,
    XStack: Stack,
    YStack: Stack,
    DelayedFreeze: Stack,
    HeaderScrollGestureWrapper: Stack,
    ScrollView: ({
      children,
      horizontal,
      onLayout,
    }: {
      children?: ReactNode;
      horizontal?: boolean;
      onLayout?: typeof mockViewportLayout;
    }) => {
      if (horizontal) {
        mockViewportLayout = onLayout;
      }
      return <div>{children}</div>;
    },
    Tabs: { TabBar: () => null },
    Skeleton: Stack,
    HeaderScrollGestureContext: React.createContext({
      excludeStartEdgeWidth: 0,
    }),
    useIsOverlayPage: () => false,
    useInPageDialog: () => ({}),
    EInPageDialogType: {},
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    usePageWidth: () => 402,
  };
});
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartLoadingMask',
  () => ({
    TradingViewChartLoadingMask: () => <div data-testid="chart-loading" />,
  }),
);
jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewNative', () => ({
  TradingViewNative: (props: unknown) => {
    mockNativeChart(props);
    return null;
  },
  getTradingViewNativeSourceKey: () => 'chart',
}));
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNativeTokenHeader',
  () => ({
    TradingViewNativeTokenHeader: () => null,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervalStorage',
  () => ({
    getTradingViewNativeIntervalStorageNamespace: () => 'market',
  }),
);
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls',
  () => ({
    TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT: 46,
    TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT: 36,
  }),
);
jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewV2', () => ({
  shouldReserveTradingViewNativeIndicatorQuickBar: () => false,
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useMobileTabTouchScrollBridge', () => ({
  useMobileTabTouchScrollBridge: () => jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => ({ perpDisabled: true }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketPerpsInfoStatusAtom: () => ['settled'],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailChartDisplayModePersistAtom: () => [{ mode: mockChartMode }],
  useMarketPriceSourceAtom: () => [{ source: 'token' }, jest.fn()],
  useMarketTradingViewIndicatorSettingsPersistAtom: () => [{}],
  useMarketTradingViewSubIndicatorCountPersistAtom: () => [{}, jest.fn()],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({}));
jest.mock('@onekeyhq/shared/src/keyboard', () => ({}));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: () => () => null,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true, isExtension: false },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isBTCMainnet: () => false },
}));
jest.mock('../../hooks/usePerpsNavigation', () => ({
  usePerpsNavigation: () => ({}),
}));
jest.mock('../../MarketWatchListProviderMirrorV2', () => ({}));
jest.mock('../components/InformationPanel/InformationPanel', () => ({
  InformationPanel: () => null,
}));
jest.mock('../components/InformationPanel/StockMobilePriceHeader', () => ({
  STOCK_MOBILE_PRICE_HEADER_HEIGHT: 100,
}));
jest.mock(
  '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData',
  () => ({ usePortfolioData: () => ({}) }),
);
jest.mock('../components/InformationTabs/hooks/useNetworkAccount', () => ({
  useNetworkAccount: () => ({}),
}));
jest.mock('../components/InformationTabs/layout/MarketDetailScroll', () => ({
  MarketDetailHeaderGesture: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('../components/InformationTabs/layout/MobileInformationTabs', () => ({
  MobileInformationTabs: ({
    renderHeader,
  }: {
    renderHeader: () => ReactNode;
  }) => <>{renderHeader()}</>,
}));
jest.mock(
  '../components/InformationTabs/layout/legacyMobileInformationTabs',
  () => ({
    MobileInformationTabs: () => null,
  }),
);
jest.mock(
  '../components/PerpetualTradingBanner/PerpetualTradingBanner',
  () => ({
    PerpetualTradingBanner: () => null,
  }),
);
jest.mock('../components/MarketTradingView/LazyMarketTradingView', () => ({
  LazyMobileMarketTradingView: (props: unknown) => {
    mockWebViewChart(props);
    return null;
  },
}));
jest.mock('../hooks/StockDetailContext', () => {
  const { useStockPriceSourceState } = jest.requireActual<
    typeof import('../hooks/stockPriceSourceState')
  >('../hooks/stockPriceSourceState');
  return {
    useStockDetail: () => ({
      isStockRoute: true,
      stockId: 'AAPL',
      stockDetail: mockStockDetail,
      priceSource: useStockPriceSourceState({
        stockId: 'AAPL',
        stockDetail: mockStockDetail,
        isStockDetailError: mockStockDetailError,
      }),
    }),
  };
});
jest.mock('../hooks/useMarketDetailDisplayData', () => ({
  useMarketDetailDisplayData: () => ({
    networkId: 'evm--1',
    tokenAddress: '0xaapl',
  }),
}));
jest.mock('../hooks/useMarketKlineLivePrice', () => ({
  useMarketKlineLivePrice: jest.fn(),
}));
jest.mock('../hooks/useMarketNativeChartLayout', () => ({
  useMarketNativeChartLayout: () => ({ subIndicatorCount: 1 }),
}));
jest.mock('../hooks/useMarketNativeChartPriceUpdate', () => ({
  useMarketNativeChartPriceUpdate: () => jest.fn(),
}));
jest.mock('../hooks/useStockPortfolioData', () => ({
  useStockPortfolioData: () => ({}),
}));
jest.mock('../hooks/useTokenDetail', () => ({
  useMarketTradingViewParams: () => ({
    networkId: 'evm--1',
    tokenAddress: '0xaapl',
  }),
}));
jest.mock('../hooks/useTradingViewSubIndicatorCount', () => ({
  useTradingViewSubIndicatorCount: () => [1, jest.fn()],
}));
jest.mock('./MobileSimpleChart', () => {
  const { useStockPriceSource } = jest.requireActual<
    typeof import('../hooks/useStockPriceSource')
  >('../hooks/useStockPriceSource');
  return {
    MOBILE_SIMPLE_CHART_HEIGHT: 308,
    MobileChartModeControl: () => null,
    MobileSimpleChart: () => {
      mockSimpleChart({ priceMode: useStockPriceSource().priceMode });
      return null;
    },
  };
});

const renderLayout = () => (
  <MobileLayout
    disableTrade
    isChartFullscreen={false}
    isTradingViewNative={mockPreferNative}
    onChartFullscreenChange={jest.fn()}
    onChartSwitch={jest.fn()}
  />
);

it('resizes both read-only extension pages to their measured viewport', () => {
  const isExtension = jest.replaceProperty(platformEnv, 'isExtension', true);
  const isNative = jest.replaceProperty(platformEnv, 'isNative', false);
  const isNativeIOS = jest.replaceProperty(platformEnv, 'isNativeIOS', false);
  try {
    const { container } = render(
      <LegacyMobileLayout
        disableTrade
        isChartFullscreen={false}
        isTradingViewNative={false}
        onChartFullscreenChange={jest.fn()}
        onChartSwitch={jest.fn()}
      />,
    );
    const expectPageHeights = (height: number) => {
      act(() => {
        mockViewportLayout?.({ nativeEvent: { layout: { height } } });
      });
      expect(
        container.querySelectorAll(`[data-stack-height="${height}"]`),
      ).toHaveLength(2);
    };
    expectPageHeights(500);
    expectPageHeights(420);
  } finally {
    isExtension.restore();
    isNative.restore();
    isNativeIOS.restore();
    mockViewportLayout = undefined;
  }
});

describe.each([
  ['simple', true],
  ['pro', true],
  ['pro', false],
] as const)(
  '%s mobile stock chart initialization (native=%s)',
  (mode, preferNative) => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockChartMode = mode;
      mockPreferNative = preferNative;
      mockStockDetail = undefined;
      mockStockDetailError = false;
    });

    it.each([
      ['open', 'share'],
      ['closed', 'token'],
      ['failed', 'token'],
    ] as const)(
      'waits for the %s market default before mounting a chart',
      (status, source) => {
        const view = render(renderLayout());
        expect(view.getByTestId('chart-loading')).toBeTruthy();
        expect(mockSimpleChart).not.toHaveBeenCalled();
        expect(mockNativeChart).not.toHaveBeenCalled();
        expect(mockWebViewChart).not.toHaveBeenCalled();

        mockStockDetail =
          status === 'failed'
            ? undefined
            : { marketStatus: { isOpen: status === 'open' } };
        mockStockDetailError = status === 'failed';
        view.rerender(renderLayout());
        expect(view.queryByTestId('chart-loading')).toBeNull();
        if (mode === 'simple') {
          expect(mockSimpleChart).toHaveBeenLastCalledWith({
            priceMode: source,
          });
        } else if (!preferNative && source === 'token') {
          expect(mockWebViewChart).toHaveBeenLastCalledWith(
            expect.objectContaining({ tokenAddress: '0xaapl' }),
          );
          expect(mockNativeChart).not.toHaveBeenCalled();
        } else {
          expect(mockNativeChart).toHaveBeenLastCalledWith(
            expect.objectContaining({
              source: expect.objectContaining({
                kind: source === 'share' ? 'stock' : 'market',
              }),
            }),
          );
        }
      },
    );
  },
);
