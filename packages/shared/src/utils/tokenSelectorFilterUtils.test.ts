import {
  filterTokenSelectorTokensByBackendIndexedNetworks,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from './tokenSelectorFilterUtils';

describe('tokenSelectorFilterUtils', () => {
  describe('isTokenSelectorDappTokenFilterSupportedNetwork', () => {
    it('supports all networks so the DeFi token switch can filter indexed networks', () => {
      expect(
        isTokenSelectorDappTokenFilterSupportedNetwork({
          network: {
            id: 'onekeyall',
            isAllNetworks: true,
            backendIndex: false,
          },
        }),
      ).toBe(true);
    });

    it('supports backend-indexed EVM networks', () => {
      expect(
        isTokenSelectorDappTokenFilterSupportedNetwork({
          network: {
            id: 'evm--1',
            isAllNetworks: false,
            backendIndex: true,
          },
        }),
      ).toBe(true);
    });

    it('supports backend-indexed non-EVM networks', () => {
      expect(
        isTokenSelectorDappTokenFilterSupportedNetwork({
          network: {
            id: 'btc--0',
            isAllNetworks: false,
            backendIndex: true,
          },
        }),
      ).toBe(true);
    });

    it('does not support non-indexed EVM networks', () => {
      expect(
        isTokenSelectorDappTokenFilterSupportedNetwork({
          network: {
            id: 'evm--324',
            isAllNetworks: false,
            backendIndex: false,
          },
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
