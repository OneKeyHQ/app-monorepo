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
let mockMarketPriceSource: 'share' | 'token' = 'share';
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

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewNative', () => ({
  TradingViewNative: () => null,
}));

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
      symbol: 'AAPL',
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
    tokenAddress: '0xaapl',
    networkId: 'evm--1',
    tokenDetail: {
      address: '0xaapl',
      symbol: 'AAPL',
      decimals: 18,
    },
    isNative: false,
  })),
}));

jest.mock('../utils/getMarketDetailTradingViewNativeSource', () => ({
  getMarketDetailTradingViewNativeSource: jest.fn(() => ({ kind: 'token' })),
}));

jest.mock('./StockDesktopLayout', () => ({
  StockDesktopLayout: (props: Record<string, unknown>) =>
    mockStockDesktopLayout(props),
}));

jest.mock('./TokenDesktopLayout', () => ({
  TokenDesktopLayout: () => null,
}));

jest.mock('./TopCoinsDesktopLayout', () => ({
  TopCoinsDesktopLayout: (props: Record<string, unknown>) =>
    mockTopCoinsDesktopLayout(props),
}));

describe('DesktopLayout', () => {
  beforeEach(() => {
    mockMarketPriceSource = 'share';
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
  });

  it('forwards disableTrade to the stock desktop layout', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: jest.fn(),
    });

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

  it('uses Asset K-line data for the Top Coins Pro chart', async () => {
    mockMarketPriceSource = 'token';
    mockStockDetailState = {
      isStockRoute: false,
      stockId: '',
      selectedTokenVariant: {
        networkId: 'doge--0',
        contractAddress: '',
        symbol: 'DOGE',
        decimals: 8,
      },
    };

    render(
      <DesktopLayout
        isChartFullscreen={false}
        isTradingViewNative={false}
        onChartSwitch={jest.fn()}
        onChartFullscreenChange={jest.fn()}
        isNative
        networkId="doge--0"
        tokenAddress=""
        marketTokenId="doge"
        marketTokenCategory="top_coins"
      />,
    );

    const marketTradingView = mockTopCoinsDesktopLayout.mock.calls.at(-1)?.[0]
      ?.marketTradingView as {
      key: string;
      props: {
        kLineDataFallback: (params: {
          interval: string;
          networkId: string;
          timeFrom: number;
          timeTo: number;
          tokenAddress: string;
        }) => Promise<unknown>;
        primaryKLineDataUnavailable: boolean;
      };
    };
    await marketTradingView.props.kLineDataFallback({
      interval: '1H',
      networkId: 'doge--0',
      timeFrom: 100,
      timeTo: 200,
      tokenAddress: '',
    });

    expect(marketTradingView.key).toBe('asset:doge');
    expect(marketTradingView.props.primaryKLineDataUnavailable).toBe(true);
    expect(fetchMarketAssetKLineDataMock).toHaveBeenCalledWith({
      assetId: 'doge',
      interval: '1H',
      timeFrom: 100,
      timeTo: 200,
    });
    expect(fetchMarketStockKLineDataMock).not.toHaveBeenCalled();
  });
});
