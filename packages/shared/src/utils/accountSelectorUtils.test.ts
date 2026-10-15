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

describe('accountSelectorUtils shouldResetDeriveTypeFromGlobal', () => {
  const hd = {
    walletId: 'hd-1',
    indexedAccountId: 'hd-1--0',
    othersWalletAccountId: undefined,
    networkId: 'btc--0',
    deriveType: 'BIP44' as const,
    focusedWallet: 'hd-1',
  };
  const watching = {
    walletId: 'watching',
    indexedAccountId: undefined,
    othersWalletAccountId: 'watching--btc--1',
    networkId: 'btc--0',
    deriveType: 'default' as const,
    focusedWallet: 'watching',
  };

  it('resets when returning from a watching account with its placeholder', () => {
    expect(
      accountSelectorUtils.shouldResetDeriveTypeFromGlobal({
        oldSelectedAccount: watching,
        newSelectedAccount: { ...hd, deriveType: 'default' },
      }),
    ).toBe(true);
  });

  it('resets when the network changes and the derive type was carried over', () => {
    expect(
      accountSelectorUtils.shouldResetDeriveTypeFromGlobal({
        oldSelectedAccount: {
          ...hd,
          networkId: 'evm--1',
          deriveType: 'default',
        },
        newSelectedAccount: { ...watching },
      }),
    ).toBe(true);
  });

  it('keeps a derive type the caller changed on purpose', () => {
    expect(
      accountSelectorUtils.shouldResetDeriveTypeFromGlobal({
        oldSelectedAccount: watching,
        newSelectedAccount: { ...hd, deriveType: 'BIP86' },
      }),
    ).toBe(false);
  });

  it('keeps the derive type between HD accounts on the same network', () => {
    expect(
      accountSelectorUtils.shouldResetDeriveTypeFromGlobal({
        oldSelectedAccount: hd,
        newSelectedAccount: { ...hd, indexedAccountId: 'hd-1--1' },
      }),
    ).toBe(false);
  });

  it('keeps the derive type when moving into a watching account on the same network', () => {
    expect(
      accountSelectorUtils.shouldResetDeriveTypeFromGlobal({
        oldSelectedAccount: hd,
        newSelectedAccount: { ...watching, deriveType: 'BIP44' },
      }),
    ).toBe(false);
  });
});

describe('accountSelectorUtils getGlobalDeriveTypeFromMap', () => {
  it('reads the saved derive type by network impl', () => {
    expect(
      accountSelectorUtils.getGlobalDeriveTypeFromMap({
        networkId: 'btc--0',
        globalDeriveTypesMap: { btc: 'BIP44' },
      }),
    ).toBe('BIP44');
    expect(
      accountSelectorUtils.getGlobalDeriveTypeFromMap({
        networkId: 'evm--1',
        globalDeriveTypesMap: { evm: 'default' },
      }),
    ).toBe('default');
  });

  it('defaults BTC networks to Taproot when nothing was saved', () => {
    expect(
      accountSelectorUtils.getGlobalDeriveTypeFromMap({
        networkId: 'btc--0',
        globalDeriveTypesMap: {},
      }),
    ).toBe('BIP86');
    expect(
      accountSelectorUtils.getGlobalDeriveTypeFromMap({
        networkId: 'tbtc--0',
        globalDeriveTypesMap: undefined,
      }),
    ).toBe('BIP86');
  });

  it('leaves other networks unresolved when nothing was saved', () => {
    expect(
      accountSelectorUtils.getGlobalDeriveTypeFromMap({
        networkId: 'evm--1',
        globalDeriveTypesMap: {},
      }),
    ).toBeUndefined();
  });
});
