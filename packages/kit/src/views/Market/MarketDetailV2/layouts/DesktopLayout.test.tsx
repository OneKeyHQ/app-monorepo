/** @jest-environment jsdom */
import { render } from '@testing-library/react';

import { DesktopLayout } from './DesktopLayout';

const mockStockDesktopLayout = jest.fn(
  (_props: Record<string, unknown>) => null,
);

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
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketStockKLineData',
  () => ({ fetchMarketStockKLineData: jest.fn() }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketPriceSourceAtom: jest.fn(() => [{ source: 'share' }]),
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
  useStockDetail: jest.fn(() => ({
    isStockRoute: true,
    stockId: 'AAPL',
    selectedTokenVariant: {
      networkId: 'evm--1',
      contractAddress: '0xaapl',
      symbol: 'AAPL',
      decimals: 18,
    },
  })),
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

jest.mock('../utils/fetchCoinGeckoKLineFallback', () => ({
  buildCoinGeckoKLineFallback: jest.fn(),
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
  TopCoinsDesktopLayout: () => null,
}));

describe('DesktopLayout', () => {
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
});
