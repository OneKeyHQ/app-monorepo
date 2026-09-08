/** @jest-environment jsdom */

import { render, waitFor } from '@testing-library/react';

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
    options?: { watchLoading?: boolean },
  ) => ({
    result: options?.watchLoading ? mockWatchlistApiResult : null,
    isLoading: false,
    run: mockRun,
  }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ networkList: mockNetworkList }),
}));

describe('useMarketWatchlistTokenList network logos', () => {
  it('uses dynamic Market config logos for watchlist rows', async () => {
    let latestData: IMarketToken[] = [];
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
      return null;
    }

    render(<Probe />);

    await waitFor(() => {
      expect(latestData).toHaveLength(1);
      expect(latestData[0]?.networkLogoUri).toBe(
        'https://example.com/monad.png',
      );
    });
  });
});
