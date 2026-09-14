/** @jest-environment jsdom */

import { useMarketBannerDetail } from '.';

import { render, renderHook } from '@testing-library/react';

import type {
  IMarketStockPublicItem,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';

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

    function Probe() {
      latestNetworkLogoUri = useMarketBannerDetail({
        tokenListId: 'dynamic-network-list',
        isPerps: false,
      }).mobileData[0]?.networkLogoUri;
      return null;
    }

    render(<Probe />);

    expect(latestNetworkLogoUri).toBe('https://example.com/monad.png');
  });
});

it('keeps stock identity without exposing it as a contract address', async () => {
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
});
