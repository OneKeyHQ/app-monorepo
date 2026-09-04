/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import type { IMarketTokenBatchRequestParams } from '@onekeyhq/shared/types/marketV2';

import { useMarketWatchlistTokenList } from './useMarketWatchlistTokenList';

import type { IMarketToken } from '../MarketTokenData';

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
const mockWatchlistApiResult = {
  list: [
    {
      address: '0xmonad',
      name: 'Monad Token',
      symbol: 'MON',
      decimals: 18,
      networkId: 'evm--143',
      isNative: false,
    },
  ],
};
const mockRun = jest.fn(async () => undefined);
const mockFetchMarketTokenListBatchForPlatform = jest.fn(
  async (_params: IMarketTokenBatchRequestParams) => ({ list: [] }),
);
let mockSpotResult: typeof mockWatchlistApiResult | { list: [] } =
  mockWatchlistApiResult;
let mockSpotLoading = false;
let mockPerpsLoading = false;
let mockSpotMethod: (() => Promise<unknown>) | undefined;

jest.mock('@onekeyhq/components', () => ({
  useCarouselIndex: () => 0,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {},
    serviceHyperliquid: {},
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<unknown>,
    _deps: unknown[],
    options?: { revalidateOnFocus?: boolean },
  ) => {
    if (options?.revalidateOnFocus) {
      mockSpotMethod = method;
      return {
        result: mockSpotResult,
        isLoading: mockSpotLoading,
        run: mockRun,
      };
    }
    return {
      result: null,
      isLoading: mockPerpsLoading,
      run: mockRun,
    };
  },
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ networkList: mockNetworkList }),
}));

jest.mock('./marketTokenBatchPlatformApi', () => ({
  fetchMarketTokenListBatchForPlatform: (
    params: Parameters<typeof mockFetchMarketTokenListBatchForPlatform>[0],
  ) => mockFetchMarketTokenListBatchForPlatform(params),
}));

describe('useMarketWatchlistTokenList network logos', () => {
  beforeEach(() => {
    mockSpotResult = mockWatchlistApiResult;
    mockSpotLoading = false;
    mockPerpsLoading = false;
    mockSpotMethod = undefined;
    mockFetchMarketTokenListBatchForPlatform.mockClear();
  });

  it('builds watchlist rows synchronously with dynamic Market config logos', () => {
    let latestData: IMarketToken[] = [];
    const committedLengths: number[] = [];
    const watchlist = [
      {
        chainId: 'evm--143',
        contractAddress: '0xmonad',
        isNative: false,
      },
    ];

    function Probe() {
      latestData = useMarketWatchlistTokenList({
        watchlist,
        pollingInterval: 0,
      }).data;
      committedLengths.push(latestData.length);
      return null;
    }

    render(<Probe />);

    expect(committedLengths[0]).toBe(1);
    expect(latestData).toHaveLength(1);
    expect(latestData[0]?.networkLogoUri).toBe('https://example.com/monad.png');
  });

  it('keeps loading active while a perps-only watchlist is resolving', () => {
    mockSpotResult = { list: [] };
    mockPerpsLoading = true;
    let latestIsLoading = false;

    function Probe() {
      latestIsLoading = useMarketWatchlistTokenList({
        watchlist: [
          {
            chainId: '',
            contractAddress: '',
            perpsCoin: 'BTC',
          },
        ],
        pollingInterval: 0,
      }).isLoading;
      return null;
    }

    render(<Probe />);

    expect(latestIsLoading).toBe(true);
  });

  it('normalizes legacy native watchlist entries before requesting them', async () => {
    function Probe() {
      useMarketWatchlistTokenList({
        watchlist: [
          {
            chainId: 'evm--native-test',
            contractAddress: '0xnative',
            isNative: undefined,
          },
        ],
        pollingInterval: 0,
      });
      return null;
    }

    render(<Probe />);
    await mockSpotMethod?.();

    expect(mockFetchMarketTokenListBatchForPlatform).toHaveBeenCalledWith({
      tokenAddressList: [
        {
          chainId: 'evm--native-test',
          contractAddress: '0xnative',
          isNative: true,
        },
      ],
    });
  });
});
