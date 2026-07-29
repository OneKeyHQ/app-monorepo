import {
  buildSwapAllNetworkTokenListCacheKey,
  dedupeTokenSelectorNetworkAccounts,
  filterTokenSelectorTokensByBackendIndexedNetworks,
  isTokenSelectorDappTokenFilterSupportedNetworkBase,
} from './tokenSelectorFilterUtils';

describe('tokenSelectorFilterUtils', () => {
  describe('isTokenSelectorDappTokenFilterSupportedNetworkBase', () => {
    it('requires backend indexing and DeFi support', () => {
      expect(
        isTokenSelectorDappTokenFilterSupportedNetworkBase({
          backendIndex: true,
          isDeFiEnabled: true,
        }),
      ).toBe(true);
      expect(
        isTokenSelectorDappTokenFilterSupportedNetworkBase({
          backendIndex: true,
          isDeFiEnabled: false,
        }),
      ).toBe(false);
      expect(
        isTokenSelectorDappTokenFilterSupportedNetworkBase({
          backendIndex: false,
          isDeFiEnabled: true,
        }),
      ).toBe(false);
    });
  });

  describe('filterTokenSelectorTokensByBackendIndexedNetworks', () => {
    it('keeps only tokens from backend-indexed networks', () => {
      expect(
        filterTokenSelectorTokensByBackendIndexedNetworks({
          tokens: [
            { networkId: 'evm--1', symbol: 'ETH' },
            { networkId: 'evm--324', symbol: 'ZK' },
            { symbol: 'UNKNOWN' },
          ],
          backendIndexedNetworkIds: ['evm--1'],
        }),
      ).toEqual([{ networkId: 'evm--1', symbol: 'ETH' }]);
    });
  });

  describe('dedupeTokenSelectorNetworkAccounts', () => {
    it('keeps one request per network and API address', () => {
      expect(
        dedupeTokenSelectorNetworkAccounts([
          {
            accountId: 'account-1',
            apiAddress: '0xAccount',
            networkId: 'evm--1',
          },
          {
            accountId: 'account-2',
            apiAddress: '0xaccount',
            networkId: 'evm--1',
          },
          {
            accountId: 'account-3',
            apiAddress: '0xAccount',
            networkId: 'evm--56',
          },
          {
            accountId: 'account-4',
            networkId: 'sol--101',
          },
        ]),
      ).toEqual([
        {
          accountId: 'account-1',
          apiAddress: '0xAccount',
          networkId: 'evm--1',
        },
        {
          accountId: 'account-3',
          apiAddress: '0xAccount',
          networkId: 'evm--56',
        },
      ]);
    });
  });

  describe('buildSwapAllNetworkTokenListCacheKey', () => {
    it('keeps all-network token caches isolated by swap protocol', () => {
      const baseParams = {
        accountId: 'hd-1',
        currency: 'usd',
      };

      expect(
        buildSwapAllNetworkTokenListCacheKey({
          ...baseParams,
          protocol: 'swap',
        }),
      ).not.toBe(
        buildSwapAllNetworkTokenListCacheKey({
          ...baseParams,
          protocol: 'stock',
        }),
      );
      expect(
        buildSwapAllNetworkTokenListCacheKey({
          ...baseParams,
          lpToken: true,
          protocol: 'stock',
        }),
      ).toBe('hd-1__stock__lpToken__usd');
    });
  });
});
