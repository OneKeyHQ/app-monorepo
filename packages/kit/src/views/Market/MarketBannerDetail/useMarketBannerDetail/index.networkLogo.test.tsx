/** @jest-environment jsdom */

import { useMarketBannerDetail } from '.';

import { render } from '@testing-library/react';

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
const mockTickerResult = [
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
  default: { serviceMarketV2: {} },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: mockTickerResult,
    isLoading: false,
  }),
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
