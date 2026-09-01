import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { buildSwapTokenFetchParams } from './swapTokenFetchParamsUtils';

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
