/** @jest-environment jsdom */
import { render } from '@testing-library/react';

import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';

import { MobileLayout } from './MobileLayout';

const mockLazyMobileMarketTradingView = jest.fn(
  (_props: Record<string, unknown>) => null,
);
const mockFetchMarketAssetKLineData = jest.mocked(fetchMarketAssetKLineData);
let mockLazyMobileMarketTradingViewMountCount = 0;
let mockLazyMobileMarketTradingViewUnmountCount = 0;
let mockMarketTradingViewParams:
  | {
      tokenAddress: string;
      networkId: string;
      tokenSymbol: string;
      decimal: number;
      isNative: boolean;
      dataSource: 'websocket' | 'polling';
    }
  | undefined;

jest.mock('react-intl', () => ({
  useIntl: jest.fn(() => ({
    formatMessage: jest.fn((message: { id: string }) => message.id),
  })),
}));

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useWindowDimensions: jest.fn(() => ({ height: 800, width: 390 })),
  };
});

jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn((value) => ({ value })),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = React.forwardRef<
    HTMLDivElement,
    { children?: React.ReactNode }
  >(({ children }, ref) => React.createElement('div', { ref }, children));
  Container.displayName = 'Container';
  return {
    EInPageDialogType: {
      inModalPage: 'inModalPage',
      inTabPages: 'inTabPages',
    },
    HeaderScrollGestureWrapper: Container,
    ScrollView: Container,
    Spinner: () => null,
    Stack: Container,
    Tabs: { TabBar: () => null },
    YStack: Container,
    useInPageDialog: jest.fn(() => ({ show: jest.fn() })),
    useIsOverlayPage: jest.fn(() => false),
    usePageWidth: jest.fn(() => 390),
    useSafeAreaInsets: jest.fn(() => ({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })),
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: unknown }) =>
    children,
}));

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewNative', () => ({
  TradingViewNative: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartConstants',
  () => ({ TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT: 100 }),
);

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/utils/fullscreenLayout',
  () => ({
    getTradingViewNativeFullscreenLayout: jest.fn(() => ({
      contentHeight: 800,
      contentWidth: 390,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    })),
  }),
);

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewV2', () => ({
  shouldReserveTradingViewNativeIndicatorQuickBar: jest.fn(() => false),
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls',
  () => ({
    TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT: 48,
    TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT: 48,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData',
  () => ({ fetchMarketAssetKLineData: jest.fn() }),
);

jest.mock('@onekeyhq/kit/src/hooks/useMobileTabTouchScrollBridge', () => ({
  useMobileTabTouchScrollBridge: jest.fn(() => jest.fn()),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { marketWatchListV2: 'marketWatchListV2' },
  useMarketTradingViewSubIndicatorCountPersistAtom: jest.fn(() => [
    {},
    jest.fn(),
  ]),
}));

jest.mock('@onekeyhq/shared/src/consts/marketConsts', () => ({
  MARKET_TOP_COINS_CATEGORY_ID: 'top_coins',
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { SwapPanelDismissKeyboard: 'SwapPanelDismissKeyboard' },
  appEventBus: { emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/keyboard', () => ({
  dismissKeyboardWithDelay: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: jest.fn(() => () => null),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_overview: 'global_overview',
    global_swap: 'global_swap',
    market_chart: 'market_chart',
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeAndroid: false,
    isNativeIOS: true,
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isBTCMainnet: jest.fn(() => false) },
}));

jest.mock('@onekeyhq/shared/types', () => ({
  EAccountSelectorSceneName: { home: 'home' },
}));

jest.mock('../../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: ({ children }: { children?: unknown }) =>
    children,
}));

jest.mock('../components/InformationPanel/InformationPanel', () => ({
  InformationPanel: () => null,
}));

jest.mock(
  '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData',
  () => ({
    usePortfolioData: jest.fn(() => ({
      portfolioData: [],
      isRefreshing: false,
    })),
  }),
);

jest.mock('../components/InformationTabs/hooks/useNetworkAccount', () => ({
  useNetworkAccount: jest.fn(() => ({})),
}));

jest.mock('../components/InformationTabs/layout/MobileInformationTabs', () => ({
  MobileInformationTabs: ({ renderHeader }: { renderHeader: () => unknown }) =>
    renderHeader(),
}));

jest.mock('../components/MarketTradingView/LazyMarketTradingView', () => ({
  LazyMobileMarketTradingView: function MockLazyMobileMarketTradingView(
    props: Record<string, unknown>,
  ) {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      mockLazyMobileMarketTradingViewMountCount += 1;
      return () => {
        mockLazyMobileMarketTradingViewUnmountCount += 1;
      };
    }, []);
    return mockLazyMobileMarketTradingView(props);
  },
}));

jest.mock(
  '../components/PerpetualTradingBanner/PerpetualTradingBanner',
  () => ({
    PerpetualTradingBanner: () => null,
  }),
);

jest.mock('../hooks/StockDetailContext', () => ({
  useStockDetail: jest.fn(() => ({ selectedTokenVariant: undefined })),
}));

jest.mock('../hooks/useTokenDetail', () => ({
  useMarketTradingViewParams: jest.fn(() => mockMarketTradingViewParams),
  useTokenDetail: jest.fn(() => ({
    tokenAddress: '',
    networkId: '',
    tokenDetail: undefined,
    tokenDetailPreview: undefined,
    isNative: false,
    websocketConfig: undefined,
    perpsInfo: undefined,
    isStockToken: false,
  })),
}));

jest.mock('../hooks/useTradingViewSubIndicatorCount', () => ({
  useTradingViewSubIndicatorCount: jest.fn(() => [0, jest.fn()]),
}));

jest.mock('../utils/getMarketDetailTradingViewNativeSource', () => ({
  getMarketDetailTradingViewNativeSource: jest.fn(() => ({
    kind: 'asset',
    assetId: 'doge',
  })),
}));

jest.mock('../utils/marketTradingViewSubIndicatorCount', () => ({
  getMarketTradingViewSubIndicatorCount: jest.fn(() => 0),
  normalizeMarketTradingViewSubIndicatorCountPersist: jest.fn(
    (value: unknown) => value,
  ),
  setMarketTradingViewSubIndicatorCount: jest.fn((value: unknown) => value),
}));

describe('MobileLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLazyMobileMarketTradingViewMountCount = 0;
    mockLazyMobileMarketTradingViewUnmountCount = 0;
    mockMarketTradingViewParams = undefined;
  });

  it('keeps the Asset Pro chart mounted while token bootstrap data loads', async () => {
    const response = {
      pointType: 'single' as const,
      points: [{ o: 1, h: 1, l: 1, c: 1, v: 0, t: 100 }],
      total: 1,
    };
    mockFetchMarketAssetKLineData.mockResolvedValue(response);

    const { rerender } = render(
      <MobileLayout
        isChartFullscreen={false}
        isTradingViewNative={false}
        onChartFullscreenChange={jest.fn()}
        onChartSwitch={jest.fn()}
        marketTokenId="doge"
        marketTokenCategory="top_coins"
      />,
    );

    const chartProps = mockLazyMobileMarketTradingView.mock.calls.at(
      -1,
    )?.[0] as {
      dataSource: string;
      kLineDataFallback: (params: {
        interval: string;
        timeFrom: number;
        timeTo: number;
      }) => Promise<unknown>;
      networkId: string;
      primaryKLineDataUnavailable: boolean;
      tokenAddress: string;
      tokenSymbol?: string;
    };

    await chartProps.kLineDataFallback({
      interval: '1H',
      timeFrom: 100,
      timeTo: 200,
    });

    expect(chartProps).toEqual(
      expect.objectContaining({
        dataSource: 'polling',
        networkId: '',
        primaryKLineDataUnavailable: true,
        tokenAddress: '',
        tokenSymbol: undefined,
      }),
    );
    expect(mockFetchMarketAssetKLineData).toHaveBeenCalledWith({
      assetId: 'doge',
      interval: '1H',
      timeFrom: 100,
      timeTo: 200,
    });

    mockMarketTradingViewParams = {
      tokenAddress: '',
      networkId: 'doge--0',
      tokenSymbol: 'DOGE',
      decimal: 8,
      isNative: true,
      dataSource: 'websocket',
    };
    rerender(
      <MobileLayout
        isChartFullscreen={false}
        isTradingViewNative={false}
        onChartFullscreenChange={jest.fn()}
        onChartSwitch={jest.fn()}
        marketTokenId="doge"
        marketTokenCategory="top_coins"
      />,
    );

    expect(mockLazyMobileMarketTradingViewMountCount).toBe(1);
    expect(mockLazyMobileMarketTradingViewUnmountCount).toBe(0);
    expect(mockLazyMobileMarketTradingView.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        dataSource: 'polling',
        networkId: 'doge--0',
        tokenAddress: '',
        tokenSymbol: 'DOGE',
      }),
    );
  });
});
