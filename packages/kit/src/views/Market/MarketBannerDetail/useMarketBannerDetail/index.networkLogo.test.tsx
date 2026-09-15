/** @jest-environment jsdom */

import { useMarketBannerDetail } from '.';

import { render, renderHook } from '@testing-library/react';

import type {
  IMarketStockPublicItem,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';

import { getStockPeRatioValue } from '../../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

const mockNetworkList = [
  {
    networkId: 'evm--143',
    index: 1,
    name: 'Monad',
    logoUrl: 'https://example.com/monad.png',
    explorerUrl: 'https://example.com',
    chainId: '143',
  },
];
const mockFetchStocks = jest.fn<Promise<IMarketStockPublicItem[]>, []>();
let mockRequest: () => Promise<unknown>;
let mockTickerResult: IMarketTokenListItem[] = [
  {
    address: '0xmonad',
    name: 'Monad Token',
    symbol: 'MON',
    decimals: 18,
    networkId: 'evm--143',
  },
];
const mockBannerSort = {
  sortBy: undefined,
  sortType: undefined,
};
const mockSetBannerSort = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketBannerStockTokenList: (...args: []) =>
        mockFetchStocks(...args),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (request: () => Promise<unknown>) => {
    mockRequest = request;
    return { result: mockTickerResult, isLoading: false };
  },
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ networkList: mockNetworkList }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketBannerListSortAtom: () => [mockBannerSort, mockSetBannerSort],
}));

describe('useMarketBannerDetail network logos', () => {
  it('uses dynamic Market config logos for banner rows', () => {
    let latestNetworkLogoUri: string | undefined;
    let latestStockItems: IMarketStockPublicItem[] | undefined;

    function Probe() {
      const { mobileData, stockItems } = useMarketBannerDetail({
        tokenListId: 'dynamic-network-list',
        isPerps: false,
      });
      latestNetworkLogoUri = mobileData[0]?.networkLogoUri;
      latestStockItems = stockItems;
      return null;
    }

    render(<Probe />);

    expect(latestNetworkLogoUri).toBe('https://example.com/monad.png');
    expect(latestStockItems).toEqual([]);
  });
});

it.each(['27.46', '0', '-3.5', undefined])(
  'preserves stock identity and P/E (%s) through API mapping',
  async (peRatio) => {
    mockFetchStocks.mockResolvedValue([
      {
        stockId: 'AAPL',
        name: 'Apple',
        symbol: 'AAPL',
        logoUrl: '',
        price: '100',
        priceChange24hPercent: '1',
        assetType: 'stock',
        currency: 'USD',
        peRatio,
      },
    ]);
    const { result, rerender } = renderHook(() =>
      useMarketBannerDetail({
        tokenListId: 'stocks',
        isPerps: false,
        isStock: true,
      }),
    );
    const response = await mockRequest();
    expect(response).toEqual([
      expect.objectContaining({ address: '', stockId: 'AAPL' }),
    ]);
    mockTickerResult = response as typeof mockTickerResult;
    rerender();
    expect(result.current.mobileData[0].address).toBe('');
    expect(result.current.mobileData[0].stock?.stockId).toBe('AAPL');
    expect(getStockPeRatioValue(result.current.listResult.data[0])).toBe(
      peRatio,
    );
    expect(result.current.stockItems).toHaveLength(1);
  },
);

it('returns raw stock rows for the desktop stock table', async () => {
  const stock: IMarketStockPublicItem = {
    stockId: 'TSLA',
    name: 'Tesla',
    symbol: 'TSLA',
    logoUrl: '',
    price: '250',
    priceChange24hPercent: '-1.2',
    marketCap: '800000000000',
    volume24h: '9000000000',
    assetType: 'stock',
    currency: 'USD',
    sparkline: [249, 250],
  };
  mockFetchStocks.mockResolvedValue([stock]);
  const { result, rerender } = renderHook(() =>
    useMarketBannerDetail({
      tokenListId: 'stocks',
      isPerps: false,
      isStock: true,
    }),
  );
  const response = await mockRequest();
  mockTickerResult = response as typeof mockTickerResult;
  rerender();
  expect(result.current.stockItems).toEqual([stock]);
  // The desktop table must receive the untouched API row, not a mapped copy.
  expect(result.current.stockItems[0]).toBe(stock);
  expect(result.current.mobileData[0].stock?.stockId).toBe('TSLA');
});
