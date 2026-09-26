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

  it('keeps a cleared derive type when the target already has its own network', () => {
    // simpleDb reads an All Networks selection back with `deriveType: undefined`;
    // the source's BTC derivation must not leak onto it.
    const result = accountSelectorUtils.buildMergedSelectedAccount({
      data: {
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--0',
        othersWalletAccountId: undefined,
        networkId: 'onekeyall--0',
        deriveType: undefined,
        focusedWallet: 'hd-1',
      },
      mergedByData: {
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--1',
        othersWalletAccountId: undefined,
        networkId: 'btc--0',
        deriveType: 'BIP86',
        focusedWallet: 'hd-1',
      },
    });

    expect(result.networkId).toBe('onekeyall--0');
    expect(result.deriveType).toBeUndefined();
    expect(result.indexedAccountId).toBe('hd-1--1');
  });

  it('inherits the source derive type together with the source network', () => {
    const result = accountSelectorUtils.buildMergedSelectedAccount({
      data: {
        walletId: undefined,
        indexedAccountId: undefined,
        othersWalletAccountId: undefined,
        networkId: undefined,
        deriveType: 'default',
        focusedWallet: undefined,
      },
      mergedByData: {
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--0',
        othersWalletAccountId: undefined,
        networkId: 'btc--0',
        deriveType: 'BIP86',
        focusedWallet: 'hd-1',
      },
    });

    expect(result.networkId).toBe('btc--0');
    expect(result.deriveType).toBe('BIP86');
  });
});

describe('WalletConnect account selector identity', () => {
  it('isolates session and proposal selectors while retaining website origin validation', () => {
    const sceneName = EAccountSelectorSceneName.discover;
    const a = accountSelectorUtils.buildWalletConnectSceneUrl({
      topic: 'a'.repeat(64),
    });
    const b = accountSelectorUtils.buildWalletConnectSceneUrl({
      topic: 'b'.repeat(64),
    });
    const proposal = accountSelectorUtils.buildWalletConnectSceneUrl({
      proposalId: 123,
    });
    const ids = [a, b, proposal, 'https://help.onekey.so'].map((sceneUrl) =>
      accountSelectorUtils.buildAccountSelectorSceneId({ sceneName, sceneUrl }),
    );
    expect(new Set(ids).size).toBe(4);
    expect(() =>
      accountSelectorUtils.buildAccountSelectorSceneId({
        sceneName,
        sceneUrl: 'https://help.onekey.so/path',
      }),
    ).toThrow('full url is not allowed');
    expect(() =>
      accountSelectorUtils.buildAccountSelectorSceneId({
        sceneName,
        sceneUrl: 'walletconnect:session:invalid',
      }),
    ).toThrow('full url is not allowed');
  });
});
