import { EAccountSelectorSceneName } from '../../types';

import accountSelectorUtils from './accountSelectorUtils';

describe('accountSelectorUtils Prime payment scene', () => {
  it('keeps temporary payment selection out of persisted and global state', () => {
    const sceneName = EAccountSelectorSceneName.primePayment;

    expect(accountSelectorUtils.isSceneCanPersist({ sceneName })).toBe(false);
    expect(accountSelectorUtils.isSceneCanAutoSelect({ sceneName })).toBe(
      false,
    );
    expect(
      accountSelectorUtils.isSceneAutoSaveToGlobalDeriveType({ sceneName }),
    ).toBe(false);
  });
});

describe('accountSelectorUtils buildMergedSelectedAccount', () => {
  it('does not let an explicit undefined networkId override the merged source network', () => {
    const result = accountSelectorUtils.buildMergedSelectedAccount({
      data: {
        walletId: undefined,
        indexedAccountId: undefined,
        othersWalletAccountId: undefined,
        networkId: undefined,
        deriveType: undefined,
        focusedWallet: undefined,
      },
      mergedByData: {
        walletId: 'hw-1',
        indexedAccountId: 'hw-1--0',
        othersWalletAccountId: undefined,
        networkId: 'onekeyall--0',
        deriveType: 'default',
        focusedWallet: 'hw-1',
      },
    });

    expect(result).toEqual({
      walletId: 'hw-1',
      indexedAccountId: 'hw-1--0',
      othersWalletAccountId: undefined,
      networkId: 'onekeyall--0',
      deriveType: 'default',
      focusedWallet: 'hw-1',
    });
  });

  it('keeps the target network context when it is defined', () => {
    const result = accountSelectorUtils.buildMergedSelectedAccount({
      data: {
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--1',
        othersWalletAccountId: undefined,
        networkId: 'evm--1',
        deriveType: 'default',
        focusedWallet: 'hd-1',
      },
      mergedByData: {
        walletId: 'hw-1',
        indexedAccountId: 'hw-1--0',
        othersWalletAccountId: undefined,
        networkId: 'onekeyall--0',
        deriveType: 'default',
        focusedWallet: 'hw-1',
      },
    });

    expect(result.networkId).toBe('evm--1');
    expect(result.walletId).toBe('hw-1');
    expect(result.indexedAccountId).toBe('hw-1--0');
    expect(result.focusedWallet).toBe('hw-1');
  });
});
