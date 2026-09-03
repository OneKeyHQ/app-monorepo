/** @jest-environment jsdom */

import { render } from '@testing-library/react';

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
let mockSpotResult: typeof mockWatchlistApiResult | { list: [] } =
  mockWatchlistApiResult;
let mockSpotLoading = false;
let mockPerpsLoading = false;

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
    _method: unknown,
    _deps: unknown[],
    options?: { revalidateOnFocus?: boolean },
  ) =>
    options?.revalidateOnFocus
      ? {
          result: mockSpotResult,
          isLoading: mockSpotLoading,
          run: mockRun,
        }
      : {
          result: null,
          isLoading: mockPerpsLoading,
          run: mockRun,
        },
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ networkList: mockNetworkList }),
}));

describe('useMarketWatchlistTokenList network logos', () => {
  beforeEach(() => {
    mockSpotResult = mockWatchlistApiResult;
    mockSpotLoading = false;
    mockPerpsLoading = false;
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
});
