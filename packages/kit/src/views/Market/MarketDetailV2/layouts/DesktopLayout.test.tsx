/** @jest-environment jsdom */
import { render } from '@testing-library/react';

import type { ITradingViewNativeProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
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
const mockNativeChartRender = jest.fn(
  (_props: ITradingViewNativeProps) => null,
);
const mockNativeChartUnmount = jest.fn();
let mockMarketPriceSource: 'share' | 'token' = 'share';
let mockTokenAddress = '0xaapl';
let mockTokenSymbol = 'AAPL';
let mockTokenDetailLoading = false;
let mockDisplayTokenDetail = {
  address: '0xaapl',
  networkId: 'evm--1',
  symbol: 'AAPL',
  decimals: 18,
  decimalsResolved: true,
};
let mockStockDetailState: {
  isStockRoute: boolean;
  stockId: string;
  isTokenVariantPending: boolean;
  isTokenVariantsError: boolean;
  isTokenVariantsLoading: boolean;
  selectedTokenVariant?: {
    networkId: string;
    contractAddress: string;
    symbol: string;
    decimals: number;
  };
} = {
  isStockRoute: true,
  stockId: 'AAPL',
  isTokenVariantPending: false,
  isTokenVariantsError: false,
  isTokenVariantsLoading: false,
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
    TradingViewNative: (props: ITradingViewNativeProps) => {
      mockNativeChartRender(props);
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
  useNetworkAccount: jest.fn(() => ({ accountAddress: 'test-account' })),
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
    tokenDetail: mockDisplayTokenDetail,
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
    isLoading: mockTokenDetailLoading,
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
    mockTokenDetailLoading = false;
    mockDisplayTokenDetail = {
      address: '0xaapl',
      networkId: 'evm--1',
      symbol: 'AAPL',
      decimals: 18,
      decimalsResolved: true,
    };
    mockStockDetailState = {
      isStockRoute: true,
      stockId: 'AAPL',
      isTokenVariantPending: false,
      isTokenVariantsError: false,
      isTokenVariantsLoading: false,
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
    mockNativeChartRender.mockClear();
    mockNativeChartUnmount.mockClear();
  });

  it('connects account marks for token charts and excludes stock share prices', () => {
    mockMarketPriceSource = 'token';
    const props = {
      isChartFullscreen: false,
      isTradingViewNative: true,
      onChartSwitch: jest.fn(),
      onChartFullscreenChange: jest.fn(),
      isNative: false,
      networkId: 'evm--1',
      tokenAddress: '0xaapl',
    } as const;
    const { rerender } = render(<DesktopLayout {...props} />);
    expect(
      mockNativeChartRender.mock.calls.at(-1)?.[0].accountMarksContext,
    ).toEqual({
      accountAddress: 'test-account',
      networkId: 'evm--1',
      tokenAddress: '0xaapl',
    });
    mockMarketPriceSource = 'share';
    rerender(<DesktopLayout {...props} />);
    expect(
      mockNativeChartRender.mock.calls.at(-1)?.[0].accountMarksContext,
    ).toBeUndefined();
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

  it('keeps the stock trade panel enabled while token metadata is loading', () => {
    const props = {
      isChartFullscreen: false,
      isTradingViewNative: false,
      onChartSwitch: jest.fn(),
      onChartFullscreenChange: jest.fn(),
      isNative: false,
      networkId: 'evm--1',
      tokenAddress: '0xaapl',
    } as const;
    const { rerender } = render(<DesktopLayout {...props} />);

    mockStockDetailState = {
      ...mockStockDetailState,
      stockId: 'MSFT',
      selectedTokenVariant: {
        networkId: 'evm--1',
        contractAddress: '0xmsft',
        symbol: 'MSFT',
        decimals: 18,
      },
    };
    mockTokenAddress = '0xmsft';
    mockTokenSymbol = 'MSFT';
    mockTokenDetailLoading = true;
    mockDisplayTokenDetail = {
      address: '0xmsft',
      networkId: 'evm--1',
      symbol: 'MSFT',
      decimals: 0,
      decimalsResolved: false,
    };
    rerender(<DesktopLayout {...props} tokenAddress="0xmsft" />);

    expect(mockStockDesktopLayout.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ disableTrade: false, isTradeLoading: true }),
    );
  });

  it('disables the stock trade panel after variants settle without a tradable token', () => {
    mockStockDetailState = {
      ...mockStockDetailState,
      selectedTokenVariant: undefined,
      isTokenVariantPending: false,
      isTokenVariantsError: false,
      isTokenVariantsLoading: false,
    };
    mockDisplayTokenDetail = {
      ...mockDisplayTokenDetail,
      decimalsResolved: false,
    };

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

    expect(mockStockDesktopLayout.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ disableTrade: true, isTradeLoading: false }),
    );
  });

  it('keeps a settled no-tradable stock disabled during variant polling', () => {
    mockStockDetailState = {
      ...mockStockDetailState,
      selectedTokenVariant: undefined,
      isTokenVariantPending: false,
      isTokenVariantsError: false,
      isTokenVariantsLoading: true,
    };
    mockDisplayTokenDetail = {
      ...mockDisplayTokenDetail,
      decimalsResolved: false,
    };

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

    expect(mockStockDesktopLayout.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ disableTrade: true, isTradeLoading: false }),
    );
  });

  it('disables the stock trade panel on a variant request error', () => {
    mockStockDetailState = {
      ...mockStockDetailState,
      selectedTokenVariant: undefined,
      isTokenVariantPending: false,
      isTokenVariantsError: true,
      isTokenVariantsLoading: false,
    };
    mockTokenDetailLoading = true;
    mockDisplayTokenDetail = {
      ...mockDisplayTokenDetail,
      decimalsResolved: false,
    };

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

    expect(mockStockDesktopLayout.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ disableTrade: true, isTradeLoading: false }),
    );
  });

  it('keeps a cached selected stock variant enabled during a variant refresh error', () => {
    mockStockDetailState = {
      ...mockStockDetailState,
      isTokenVariantPending: false,
      isTokenVariantsError: true,
      isTokenVariantsLoading: false,
    };
    mockTokenDetailLoading = true;
    mockDisplayTokenDetail = {
      ...mockDisplayTokenDetail,
      decimalsResolved: false,
    };

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

    expect(mockStockDesktopLayout.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ disableTrade: false, isTradeLoading: true }),
    );
  });

  it('does not show an endless skeleton after selected stock metadata settles invalid', () => {
    mockTokenDetailLoading = false;
    mockDisplayTokenDetail = {
      ...mockDisplayTokenDetail,
      address: '0xmissing',
      decimalsResolved: false,
    };

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

    expect(mockStockDesktopLayout.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ disableTrade: false, isTradeLoading: false }),
    );
  });

  it('keeps the stock trade panel mounted during a variant switch before token loading starts', () => {
    const props = {
      isChartFullscreen: false,
      isTradingViewNative: false,
      onChartSwitch: jest.fn(),
      onChartFullscreenChange: jest.fn(),
      isNative: false,
      networkId: 'evm--1',
      tokenAddress: '0xaapl',
    } as const;
    const { rerender } = render(<DesktopLayout {...props} />);

    mockStockDetailState = {
      ...mockStockDetailState,
      selectedTokenVariant: {
        networkId: 'evm--8453',
        contractAddress: '0xaapl-base',
        symbol: 'AAPL',
        decimals: 18,
      },
    };
    mockTokenAddress = '0xaapl-base';
    mockTokenDetailLoading = false;
    mockDisplayTokenDetail = {
      address: '0xaapl-base',
      networkId: 'evm--8453',
      symbol: 'AAPL',
      decimals: 0,
      decimalsResolved: false,
    };

    rerender(
      <DesktopLayout
        {...props}
        tokenAddress="0xaapl-base"
        isTokenDetailRequestPending
      />,
    );

    expect(mockStockDesktopLayout.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ disableTrade: false, isTradeLoading: true }),
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
          networkId: nextToken.networkId,
          contractAddress: nextToken.contractAddress,
          symbol: mockStockDetailState.selectedTokenVariant?.symbol ?? '',
          decimals: mockStockDetailState.selectedTokenVariant?.decimals ?? 0,
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
