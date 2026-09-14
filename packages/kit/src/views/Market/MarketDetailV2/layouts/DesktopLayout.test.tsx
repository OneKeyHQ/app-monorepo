/** @jest-environment jsdom */
import { render } from '@testing-library/react';

import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';
import { fetchMarketStockKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketStockKLineData';

import { DesktopLayout } from './DesktopLayout';

const mockStockDesktopLayout = jest.fn(
  (_props: Record<string, unknown>) => null,
);
const mockTopCoinsDesktopLayout = jest.fn(
  (_props: Record<string, unknown>) => null,
);
const mockNativeChartMount = jest.fn();
const mockNativeChartUnmount = jest.fn();
let mockMarketPriceSource: 'share' | 'token' = 'share';
let mockTokenAddress = '0xaapl';
let mockTokenSymbol = 'AAPL';
let mockStockDetailState = {
  isStockRoute: true,
  stockId: 'AAPL',
  selectedTokenVariant: {
    networkId: 'evm--1',
    contractAddress: '0xaapl',
    symbol: 'AAPL',
    decimals: 18,
  },
};
const fetchMarketAssetKLineDataMock = jest.mocked(fetchMarketAssetKLineData);
const fetchMarketStockKLineDataMock = jest.mocked(fetchMarketStockKLineData);

jest.mock('../hooks/useMarketNativeChartPriceUpdate', () => ({
  useMarketNativeChartPriceUpdate: jest.fn(() => jest.fn()),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Spinner: () => null,
    Stack: React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(
      ({ children }, ref) => React.createElement('div', { ref }, children),
    ),
    useOverlayZIndex: jest.fn(() => 1),
  };
});

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewNative', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TradingViewNative: () => {
      React.useEffect(() => {
        mockNativeChartMount();
        return mockNativeChartUnmount;
      }, []);
      return null;
    },
  };
});

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData',
  () => ({ fetchMarketAssetKLineData: jest.fn() }),
);

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketStockKLineData',
  () => ({ fetchMarketStockKLineData: jest.fn() }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketPriceSourceAtom: jest.fn(() => [{ source: mockMarketPriceSource }]),
}));

jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  TRADING_VIEW_LOCALHOST_ORIGIN: 'http://localhost',
  TRADING_VIEW_URL: 'https://example.com',
  TRADING_VIEW_URL_TEST: 'https://test.example.com',
}));

jest.mock('@onekeyhq/shared/src/consts/marketConsts', () => ({
  MARKET_TOP_COINS_CATEGORY_ID: 'top_coins',
}));

jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: jest.fn(() => () => null),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: false,
    isNative: false,
    isWeb: true,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getNetworkImpl: jest.fn(() => 'evm'),
    isBTCMainnet: jest.fn(() => false),
    isBTCNetwork: jest.fn(() => false),
  },
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

jest.mock('../components/MarketTradingView/LazyMarketTradingView', () => ({
  LazyDesktopMarketTradingView: () => null,
}));

jest.mock(
  '../components/MarketTradingView/MarketChartFullscreenHeader',
  () => ({ MarketChartFullscreenHeader: () => null }),
);

jest.mock('../hooks/StockDetailContext', () => ({
  useStockDetail: jest.fn(() => mockStockDetailState),
}));

jest.mock('../hooks/useMarketDetailDisplayData', () => ({
  useMarketDetailDisplayData: jest.fn(() => ({
    tokenDetail: {
      address: '0xaapl',
      networkId: 'evm--1',
      symbol: mockTokenSymbol,
      decimals: 18,
    },
  })),
}));

jest.mock('../hooks/useTokenDetail', () => ({
  useMarketTradingViewParams: jest.fn(() => ({
    tokenAddress: '0xaapl',
    networkId: 'evm--1',
    tokenSymbol: 'AAPL',
    isNative: false,
    dataSource: 'polling',
  })),
  useTokenDetail: jest.fn(() => ({
    tokenAddress: mockTokenAddress,
    networkId: 'evm--1',
    tokenDetail: {
      address: '0xaapl',
      symbol: mockTokenSymbol,
      decimals: 18,
    },
    isNative: false,
  })),
}));

jest.mock('../utils/getMarketDetailTradingViewNativeSource', () => ({
  getMarketDetailTradingViewNativeSource: jest.fn(
    ({
      networkId,
      tokenAddress,
      symbol,
    }: {
      networkId: string;
      tokenAddress: string;
      symbol: string;
    }) => ({
      kind: 'market',
      networkId,
      tokenAddress,
      symbol,
      realtime: 'websocket',
    }),
  ),
}));

jest.mock('./StockDesktopLayout', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    StockDesktopLayout: (props: Record<string, unknown>) => {
      mockStockDesktopLayout(props);
      return React.isValidElement(props.marketTradingView)
        ? props.marketTradingView
        : null;
    },
  };
});

jest.mock('./TokenDesktopLayout', () => ({
  TokenDesktopLayout: () => null,
}));

jest.mock('./TopCoinsDesktopLayout', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TopCoinsDesktopLayout: (props: Record<string, unknown>) => {
      mockTopCoinsDesktopLayout(props);
      return React.isValidElement(props.marketTradingView)
        ? props.marketTradingView
        : null;
    },
  };
});

describe('DesktopLayout', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: jest.fn(),
    });
    mockMarketPriceSource = 'share';
    mockTokenAddress = '0xaapl';
    mockTokenSymbol = 'AAPL';
    mockStockDetailState = {
      isStockRoute: true,
      stockId: 'AAPL',
      selectedTokenVariant: {
        networkId: 'evm--1',
        contractAddress: '0xaapl',
        symbol: 'AAPL',
        decimals: 18,
      },
    };
    fetchMarketAssetKLineDataMock.mockClear();
    fetchMarketStockKLineDataMock.mockClear();
    mockStockDesktopLayout.mockClear();
    mockTopCoinsDesktopLayout.mockClear();
    mockNativeChartMount.mockClear();
    mockNativeChartUnmount.mockClear();
  });

  it('forwards disableTrade to the stock desktop layout', () => {
    render(
      <DesktopLayout
        isChartFullscreen={false}
        isTradingViewNative={false}
        onChartSwitch={jest.fn()}
        onChartFullscreenChange={jest.fn()}
        isNative={false}
        networkId="evm--1"
        tokenAddress="0xaapl"
        disableTrade
      />,
    );

    expect(mockStockDesktopLayout.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ disableTrade: true }),
    );
  });

  it('waits for the addressless market symbol before mounting native candles', () => {
    mockStockDetailState = { ...mockStockDetailState, isStockRoute: false };
    mockTokenAddress = '';
    mockTokenSymbol = '';
    const props = {
      isChartFullscreen: false,
      isTradingViewNative: true,
      onChartSwitch: jest.fn(),
      onChartFullscreenChange: jest.fn(),
      isNative: true,
      networkId: 'evm--1',
      tokenAddress: '',
      marketTokenCategory: 'top_coins',
      marketTokenId: 'ethereum',
    };
    const { rerender } = render(<DesktopLayout {...props} />);
    expect(mockNativeChartMount).not.toHaveBeenCalled();

    mockTokenSymbol = 'ETH';
    rerender(<DesktopLayout {...props} />);
    expect(mockNativeChartMount).toHaveBeenCalledTimes(1);
    expect(mockNativeChartUnmount).not.toHaveBeenCalled();

    rerender(<DesktopLayout {...props} />);
    expect(mockNativeChartMount).toHaveBeenCalledTimes(1);
  });

  it.each([
    { networkId: 'evm--1', contractAddress: '0xnext' },
    { networkId: 'evm--8453', contractAddress: '0xaapl' },
  ])(
    'remounts the native chart for token changes but preserves fullscreen state: %j',
    (nextToken) => {
      mockMarketPriceSource = 'token';
      const renderLayout = (isChartFullscreen: boolean) => (
        <DesktopLayout
          isChartFullscreen={isChartFullscreen}
          isTradingViewNative
          onChartSwitch={jest.fn()}
          onChartFullscreenChange={jest.fn()}
          isNative={false}
          networkId="evm--1"
          tokenAddress="0xaapl"
        />
      );
      const { rerender } = render(renderLayout(false));
      expect(mockNativeChartMount).toHaveBeenCalledTimes(1);

      rerender(renderLayout(true));
      expect(mockNativeChartMount).toHaveBeenCalledTimes(1);
      expect(mockNativeChartUnmount).not.toHaveBeenCalled();

      mockStockDetailState = {
        ...mockStockDetailState,
        selectedTokenVariant: {
          ...mockStockDetailState.selectedTokenVariant,
          ...nextToken,
        },
      };
      rerender(renderLayout(true));
      expect(mockNativeChartUnmount).toHaveBeenCalledTimes(1);
      expect(mockNativeChartMount).toHaveBeenCalledTimes(2);
    },
  );

  it('forwards the selected Pro interval to stock K-line requests', async () => {
    render(
      <DesktopLayout
        isChartFullscreen={false}
        isTradingViewNative={false}
        onChartSwitch={jest.fn()}
        onChartFullscreenChange={jest.fn()}
        isNative={false}
        networkId="evm--1"
        tokenAddress="0xaapl"
      />,
    );

    const marketTradingView = mockStockDesktopLayout.mock.calls.at(-1)?.[0]
      ?.marketTradingView as {
      props: {
        kLineDataFallback: (params: {
          interval: string;
          networkId: string;
          timeFrom: number;
          timeTo: number;
          tokenAddress: string;
        }) => Promise<unknown>;
      };
    };
    await marketTradingView.props.kLineDataFallback({
      interval: '15m',
      networkId: 'evm--1',
      timeFrom: 100,
      timeTo: 200,
      tokenAddress: '0xaapl',
    });

    expect(fetchMarketStockKLineDataMock).toHaveBeenCalledWith({
      interval: '15m',
      stockId: 'AAPL',
      timeFrom: 100,
      timeTo: 200,
    });
  });

  it('keeps the embedded share chart independent of the token variant', () => {
    render(
      <DesktopLayout
        isChartFullscreen={false}
        isTradingViewNative={false}
        onChartSwitch={jest.fn()}
        onChartFullscreenChange={jest.fn()}
        isNative={false}
        networkId="evm--1"
        tokenAddress="0xaapl"
      />,
    );

    const marketTradingView = mockStockDesktopLayout.mock.calls.at(-1)?.[0]
      ?.marketTradingView as {
      key: string;
      props: {
        decimal?: number;
        isNative?: boolean;
        networkId: string;
        tokenAddress: string;
        tokenSymbol?: string;
      };
    };

    expect(marketTradingView.key).toBe('stock-share:AAPL');
    expect(marketTradingView.props).toEqual(
      expect.objectContaining({
        decimal: undefined,
        isNative: false,
        networkId: '',
        tokenAddress: '',
        tokenSymbol: 'AAPL',
      }),
    );
  });

  it.each([false, true])(
    'uses token K-line data for Top Coins Pro (native: %s)',
    (isTradingViewNative) => {
      mockMarketPriceSource = 'token';
      mockStockDetailState = {
        ...mockStockDetailState,
        isStockRoute: false,
        stockId: '',
      };

      render(
        <DesktopLayout
          isChartFullscreen={false}
          isTradingViewNative={isTradingViewNative}
          onChartSwitch={jest.fn()}
          onChartFullscreenChange={jest.fn()}
          isNative={false}
          networkId="evm--1"
          tokenAddress="0xaapl"
          marketTokenId="top-coin"
          marketTokenCategory="top_coins"
        />,
      );

      const marketTradingView = mockTopCoinsDesktopLayout.mock.calls.at(-1)?.[0]
        ?.marketTradingView as {
        props: {
          source?: { kind: string; networkId: string; tokenAddress: string };
          networkId?: string;
          tokenAddress?: string;
          kLineDataFallback?: unknown;
          primaryKLineDataUnavailable?: boolean;
        };
      };
      if (isTradingViewNative) {
        expect(marketTradingView.props.source).toEqual(
          expect.objectContaining({
            kind: 'market',
            networkId: 'evm--1',
            tokenAddress: '0xaapl',
          }),
        );
      } else {
        expect(marketTradingView.props).toEqual(
          expect.objectContaining({
            networkId: 'evm--1',
            tokenAddress: '0xaapl',
            primaryKLineDataUnavailable: false,
          }),
        );
        expect(marketTradingView.props.kLineDataFallback).toBeUndefined();
      }
      expect(fetchMarketAssetKLineDataMock).not.toHaveBeenCalled();
      expect(fetchMarketStockKLineDataMock).not.toHaveBeenCalled();
    },
  );
});
