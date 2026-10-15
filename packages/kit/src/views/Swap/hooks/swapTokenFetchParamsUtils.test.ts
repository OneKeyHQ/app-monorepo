import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapTokenFetchParams,
  resolveSwapTokenSearchNetworkId,
} from './swapTokenFetchParamsUtils';

function createAllNetworkAccountInfo(
  overrides: Partial<IAllNetworkAccountInfo> = {},
): IAllNetworkAccountInfo {
  return {
    networkId: 'evm--56',
    accountId: 'account-1',
    apiAddress: '0xabc',
    accountXpub: undefined,
    pub: undefined,
    dbAccount: undefined,
    isNftEnabled: false,
    isBackendIndexed: true,
    deriveType: undefined,
    deriveInfo: undefined,
    isTestnet: false,
    ...overrides,
  };
}

describe('buildSwapTokenFetchParams', () => {
  it('keeps matched account params for Stock token lists', () => {
    expect(
      buildSwapTokenFetchParams({
        currentNetworkId: 'evm--56',
        currentSelectNetworkId: 'evm--56',
        keywords: '',
        swapType: ESwapTabSwitchType.STOCK,
        requestCurrency: 'usd',
        matchedAccount: createAllNetworkAccountInfo({
          networkId: 'evm--56',
          apiAddress: '0xabc',
          accountId: 'account-1',
        }),
        shouldUseCurrentAccountAddress: false,
      }),
    ).toEqual({
      protocol: ESwapTabSwitchType.STOCK,
      networkId: 'evm--56',
      keywords: '',
      limit: 200,
      accountAddress: '0xabc',
      accountNetworkId: 'evm--56',
      accountId: 'account-1',
      lpToken: undefined,
      currency: 'usd',
    });
  });

  it('keeps the current account params for Stock token lists', () => {
    expect(
      buildSwapTokenFetchParams({
        currentNetworkId: 'evm--56',
        currentSelectNetworkId: 'evm--56',
        keywords: '',
        swapType: ESwapTabSwitchType.STOCK,
        requestCurrency: 'usd',
        shouldUseCurrentAccountAddress: true,
        currentAccountAddress: '0xdef',
        currentAccountNetworkId: 'evm--56',
        currentAccountId: 'account-2',
      }),
    ).toMatchObject({
      protocol: ESwapTabSwitchType.STOCK,
      networkId: 'evm--56',
      limit: 200,
      accountAddress: '0xdef',
      accountNetworkId: 'evm--56',
      accountId: 'account-2',
    });
  });

  it('requests the complete Stock list without inventing all-network account params', () => {
    expect(
      buildSwapTokenFetchParams({
        currentNetworkId: 'onekeyall--0',
        currentSelectNetworkId: 'onekeyall--0',
        keywords: '',
        swapType: ESwapTabSwitchType.STOCK,
        requestCurrency: 'usd',
        shouldUseCurrentAccountAddress: false,
      }),
    ).toEqual({
      protocol: ESwapTabSwitchType.STOCK,
      networkId: 'onekeyall--0',
      keywords: '',
      lpToken: undefined,
      currency: 'usd',
      limit: 200,
    });
  });

  it('keeps the default limit for non-Stock all-network requests', () => {
    expect(
      buildSwapTokenFetchParams({
        currentNetworkId: 'onekeyall--0',
        currentSelectNetworkId: 'onekeyall--0',
        keywords: '',
        swapType: ESwapTabSwitchType.SWAP,
        requestCurrency: 'usd',
        shouldUseCurrentAccountAddress: false,
      }),
    ).not.toHaveProperty('limit');
  });

  it('requests only supported swap tokens for keyword searches', () => {
    expect(
      buildSwapTokenFetchParams({
        currentNetworkId: 'evm--56',
        currentSelectNetworkId: 'evm--56',
        keywords: '苹果',
        swapType: ESwapTabSwitchType.SWAP,
        requestCurrency: 'usd',
        shouldUseCurrentAccountAddress: false,
      }),
    ).toMatchObject({
      keywords: '苹果',
      onlySwapTokens: true,
    });
  });

  it('keeps LP token keyword searches unchanged', () => {
    expect(
      buildSwapTokenFetchParams({
        currentNetworkId: 'evm--56',
        currentSelectNetworkId: 'evm--56',
        keywords: 'LP',
        swapType: ESwapTabSwitchType.SWAP,
        lpToken: true,
        requestCurrency: 'usd',
        shouldUseCurrentAccountAddress: false,
      }),
    ).not.toHaveProperty('onlySwapTokens');
  });
});

describe('resolveSwapTokenSearchNetworkId', () => {
  const allNetworksId = 'onekeyall--0';

  it('searches all networks for a pasted contract address', () => {
    expect(
      resolveSwapTokenSearchNetworkId({
        selectedNetworkId: 'evm--42161',
        keywords: 'So11111111111111111111111111111111111111112',
        swapType: ESwapTabSwitchType.SWAP,
        allNetworksId,
      }),
    ).toBe(allNetworksId);
  });

  it('keeps the selected network for symbol searches and empty keywords', () => {
    expect(
      resolveSwapTokenSearchNetworkId({
        selectedNetworkId: 'evm--42161',
        keywords: 'USDC',
        swapType: ESwapTabSwitchType.SWAP,
        allNetworksId,
      }),
    ).toBe('evm--42161');
    expect(
      resolveSwapTokenSearchNetworkId({
        selectedNetworkId: 'evm--42161',
        keywords: '',
        swapType: ESwapTabSwitchType.SWAP,
        allNetworksId,
      }),
    ).toBe('evm--42161');
  });

  it('keeps the selected network for Stock and when All Networks is unavailable', () => {
    const keywords = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    expect(
      resolveSwapTokenSearchNetworkId({
        selectedNetworkId: 'evm--1',
        keywords,
        swapType: ESwapTabSwitchType.STOCK,
        allNetworksId,
      }),
    ).toBe('evm--1');
    expect(
      resolveSwapTokenSearchNetworkId({
        selectedNetworkId: 'evm--1',
        keywords,
        swapType: ESwapTabSwitchType.SWAP,
        allNetworksId: undefined,
      }),
    ).toBe('evm--1');
  });
});
