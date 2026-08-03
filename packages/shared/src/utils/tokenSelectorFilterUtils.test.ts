import {
  buildSwapAllNetworkTokenListCacheKey,
  dedupeTokenSelectorNetworkAccounts,
  filterTokenSelectorTokenDataByDappTokenFilterParams,
  filterTokenSelectorTokensByBackendIndexedNetworks,
  isTokenSelectorDappTokenFilterSupportedNetworkBase,
} from './tokenSelectorFilterUtils';

import type { ITokenData } from '../../types/token';

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

  describe('filterTokenSelectorTokenDataByDappTokenFilterParams', () => {
    const walletToken = {
      $key: 'wallet-token',
      address: '0xwallet',
      decimals: 18,
      isNative: false,
      name: 'Wallet token',
      symbol: 'WALLET',
      dappType: 'walletToken',
    };
    const dappToken = {
      $key: 'dapp-token',
      address: '0xdapp',
      decimals: 18,
      isNative: false,
      name: 'DeFi token',
      symbol: 'DEFI',
      dappName: 'DeFi protocol',
    };
    const tokenData: ITokenData = {
      data: [walletToken, dappToken],
      keys: 'server-token-list-key',
      map: {
        [walletToken.$key]: {
          balance: '3',
          balanceParsed: '3',
          fiatValue: '3',
          price: 1,
        },
        [dappToken.$key]: {
          balance: '10',
          balanceParsed: '10',
          fiatValue: '10',
          price: 1,
        },
      },
      fiatValue: '13',
      currency: 'usd',
    };

    it('removes dApp tokens from data, map, keys, and fiatValue together', () => {
      expect(
        filterTokenSelectorTokenDataByDappTokenFilterParams({
          tokenData,
          tokenSelectorFilterParams: {
            withoutDappToken: true,
            withoutWalletToken: false,
          },
        }),
      ).toEqual({
        data: [walletToken],
        keys: walletToken.$key,
        map: {
          [walletToken.$key]: tokenData.map[walletToken.$key],
        },
        fiatValue: '3',
        currency: 'usd',
      });
    });

    it('removes wallet tokens when requesting the dApp-only list', () => {
      expect(
        filterTokenSelectorTokenDataByDappTokenFilterParams({
          tokenData,
          tokenSelectorFilterParams: {
            withoutDappToken: false,
            withoutWalletToken: true,
          },
        }),
      ).toEqual({
        data: [dappToken],
        keys: dappToken.$key,
        map: {
          [dappToken.$key]: tokenData.map[dappToken.$key],
        },
        fiatValue: '10',
        currency: 'usd',
      });
    });

    it('keeps the original token data when no token is filtered out', () => {
      expect(
        filterTokenSelectorTokenDataByDappTokenFilterParams({
          tokenData,
          tokenSelectorFilterParams: {},
        }),
      ).toBe(tokenData);
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
