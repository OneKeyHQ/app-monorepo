import {
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
});
