/** @jest-environment jsdom */

import { render, waitFor } from '@testing-library/react';

import { useMarketTokenList } from './useMarketTokenList';

const mockCachedResponse = {
  list: [
    {
      address: '0xcached',
      name: 'Cached Token',
      symbol: 'CACHED',
    },
  ],
  total: 1,
};
let mockPromiseResultResponse = mockCachedResponse;
const mockRun = jest.fn(async () => undefined);
const mockTrackNetworkLoading = jest.fn();

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: mockPromiseResultResponse,
    isLoading: false,
    run: mockRun,
  }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ minLiquidity: 5000 }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/hooks/useNetworkLoadingAnalytics',
  () => ({
    useNetworkLoadingAnalytics: () => ({
      trackNetworkLoading: mockTrackNetworkLoading,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/utils/marketHomeTokenListSeed',
  () => ({
    discardMarketHomeTokenListSeedForInit: jest.fn(),
    getMarketHomeTokenListSeedForInit: jest.fn(() => undefined),
  }),
);

jest.mock('@onekeyhq/kit/src/views/Market/utils/marketReactPerf', () => ({
  markMarketReactPerf: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isAllNetwork: () => false },
}));

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {
    getWithTimestamp: () => ({
      data: mockCachedResponse,
      updatedAt: Date.now(),
    }),
    remove: jest.fn(),
  },
  swrKeys: {
    marketHomeTokenList: () => 'market-home-token-list-test-key',
  },
}));

jest.mock('../utils/tokenListHelpers', () => ({
  getNetworkLogoUri: () => 'network-logo',
  transformApiItemToToken: (item: {
    address: string;
    name: string;
    symbol: string;
  }) => ({
    id: item.address,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    decimals: 18,
    price: 1,
    change24h: 0,
    marketCap: 0,
    liquidity: 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: 0,
    tokenImageUri: '',
    networkLogoUri: 'network-logo',
    networkId: 'evm--1',
    chainId: 'evm--1',
  }),
}));

jest.mock('./marketTokenListPlatformApi', () => ({
  fetchMarketTokenListForPlatform: jest.fn(),
}));

describe('useMarketTokenList initial data', () => {
  beforeEach(() => {
    mockPromiseResultResponse = mockCachedResponse;
  });

  it('exposes cached rows during the first render', () => {
    const renderedTokenIds: string[][] = [];

    function Probe() {
      const result = useMarketTokenList({
        networkId: 'evm--1',
        type: 'trending',
      });
      renderedTokenIds.push(result.data.map((item) => item.id));
      return null;
    }

    render(<Probe />);

    expect(renderedTokenIds[0]).toEqual(['0xcached']);
  });

  it('replaces the cached rows when the remote first page arrives', async () => {
    const renderedTokenIds: string[][] = [];

    function Probe({ revision }: { revision: number }) {
      const result = useMarketTokenList({
        networkId: 'evm--1',
        type: 'trending',
      });
      renderedTokenIds.push(result.data.map((item) => item.id));
      return <span>{revision}</span>;
    }

    const view = render(<Probe revision={0} />);
    expect(renderedTokenIds[0]).toEqual(['0xcached']);

    mockPromiseResultResponse = {
      list: [
        {
          address: '0xremote',
          name: 'Remote Token',
          symbol: 'REMOTE',
        },
      ],
      total: 1,
    };
    view.rerender(<Probe revision={1} />);

    await waitFor(() => {
      expect(renderedTokenIds.at(-1)).toEqual(['0xremote']);
    });
  });
});
