import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapSelectedAccountSyncedFromHome,
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount,
  buildSwapSelectedTokensColdStartContext,
  isSwapSelectedTokensColdStartContextMatched,
  shouldClearSwapSelectedTokensOnHomeAccountUpdate,
  shouldSyncSwapSelectedAccountOnHomeAccountUpdate,
} from './swapColdStartTokenCacheUtils';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

function buildActiveAccount(
  overrides: Partial<IAccountSelectorActiveAccountInfo> = {},
): IAccountSelectorActiveAccountInfo {
  return {
    ready: true,
    account: {
      id: 'account-evm-1',
    } as IAccountSelectorActiveAccountInfo['account'],
    indexedAccount: {
      id: 'indexed-account-1',
    } as IAccountSelectorActiveAccountInfo['indexedAccount'],
    dbAccount: {
      id: 'db-account-1',
    } as IAccountSelectorActiveAccountInfo['dbAccount'],
    accountName: 'Account 1',
    wallet: {
      id: 'wallet-1',
    } as IAccountSelectorActiveAccountInfo['wallet'],
    device: undefined,
    network: {
      id: 'evm--1',
    } as IAccountSelectorActiveAccountInfo['network'],
    vaultSettings: undefined,
    deriveType: 'default',
    deriveInfoItems: [],
    ...overrides,
  };
}

function buildSelectedAccount(
  overrides: Partial<IAccountSelectorSelectedAccount> = {},
): IAccountSelectorSelectedAccount {
  return {
    walletId: 'wallet-1',
    indexedAccountId: 'indexed-account-1',
    othersWalletAccountId: undefined,
    networkId: 'evm--1',
    deriveType: 'default',
    focusedWallet: 'wallet-1',
    ...overrides,
  };
}

describe('swap cold-start selected token context', () => {
  it('matches when account and network are unchanged', () => {
    const activeAccount = buildActiveAccount();
    const cachedContext = buildSwapSelectedTokensColdStartContext({
      activeAccount,
      networkId: 'evm--1',
      now: 1,
    });
    const currentContext = buildSwapSelectedTokensColdStartContext({
      activeAccount,
      networkId: 'evm--1',
      now: 2,
    });

    expect(
      isSwapSelectedTokensColdStartContextMatched({
        cachedContext,
        currentContext,
      }),
    ).toBe(true);
  });

  it('invalidates when the network changes', () => {
    const activeAccount = buildActiveAccount();

    expect(
      isSwapSelectedTokensColdStartContextMatched({
        cachedContext: buildSwapSelectedTokensColdStartContext({
          activeAccount,
          networkId: 'evm--1',
          now: 1,
        }),
        currentContext: buildSwapSelectedTokensColdStartContext({
          activeAccount,
          networkId: 'btc--0',
          now: 2,
        }),
      }),
    ).toBe(false);
  });

  it('invalidates when the account changes', () => {
    const cachedAccount = buildActiveAccount();
    const currentAccount = buildActiveAccount({
      indexedAccount: {
        id: 'indexed-account-2',
      } as IAccountSelectorActiveAccountInfo['indexedAccount'],
    });

    expect(
      isSwapSelectedTokensColdStartContextMatched({
        cachedContext: buildSwapSelectedTokensColdStartContext({
          activeAccount: cachedAccount,
          networkId: 'evm--1',
          now: 1,
        }),
        currentContext: buildSwapSelectedTokensColdStartContext({
          activeAccount: currentAccount,
          networkId: 'evm--1',
          now: 2,
        }),
      }),
    ).toBe(false);
  });

  it('treats legacy token cache without owner metadata as invalid', () => {
    const activeAccount = buildActiveAccount();

    expect(
      isSwapSelectedTokensColdStartContextMatched({
        cachedContext: undefined,
        currentContext: buildSwapSelectedTokensColdStartContext({
          activeAccount,
          networkId: 'evm--1',
          now: 1,
        }),
      }),
    ).toBe(false);
  });

  it('falls back to db account id then network account id for non-indexed accounts', () => {
    expect(
      buildSwapSelectedTokensColdStartAccountKey(
        buildActiveAccount({
          indexedAccount: undefined,
          dbAccount: undefined,
          account: {
            id: 'external-account-1',
          } as IAccountSelectorActiveAccountInfo['account'],
        }),
      ),
    ).toBe('wallet-1|external-account-1|default');
  });

  it('builds account key from selected account storage data', () => {
    expect(
      buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
        buildSelectedAccount(),
      ),
    ).toBe('wallet-1|indexed-account-1|default');
  });

  it('builds matching keys for others wallets across active and selected shapes', () => {
    // The runtime active-account key and the persisted selected-account key must
    // resolve to the same string for "others" wallets, where the DB account id
    // (dbAccount.id / othersWalletAccountId) differs from the INetworkAccount id.
    const activeKey = buildSwapSelectedTokensColdStartAccountKey(
      buildActiveAccount({
        indexedAccount: undefined,
        account: {
          id: 'network-account-1',
        } as IAccountSelectorActiveAccountInfo['account'],
        dbAccount: {
          id: 'others-db-account-1',
        } as IAccountSelectorActiveAccountInfo['dbAccount'],
      }),
    );
    const selectedKey =
      buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
        buildSelectedAccount({
          indexedAccountId: undefined,
          othersWalletAccountId: 'others-db-account-1',
        }),
      );

    expect(activeKey).toBe('wallet-1|others-db-account-1|default');
    expect(selectedKey).toBe('wallet-1|others-db-account-1|default');
    expect(activeKey).toBe(selectedKey);
  });

  it('clears cached selected tokens when home network changes', () => {
    const cachedContext = buildSwapSelectedTokensColdStartContext({
      activeAccount: buildActiveAccount({
        network: {
          id: 'btc--0',
        } as IAccountSelectorActiveAccountInfo['network'],
      }),
      networkId: 'btc--0',
      swapType: ESwapTabSwitchType.BRIDGE,
      now: 1,
    });

    expect(
      shouldClearSwapSelectedTokensOnHomeAccountUpdate({
        cachedContext,
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount({
            networkId: 'evm--1313161554',
          }),
        },
      }),
    ).toBe(true);
  });

  it('clears cached selected tokens when home account is disconnected or reset', () => {
    const cachedContext = buildSwapSelectedTokensColdStartContext({
      activeAccount: buildActiveAccount(),
      networkId: 'evm--1',
      swapType: ESwapTabSwitchType.SWAP,
      now: 1,
    });

    expect(
      shouldClearSwapSelectedTokensOnHomeAccountUpdate({
        cachedContext,
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount({
            walletId: '',
            indexedAccountId: undefined,
            othersWalletAccountId: undefined,
            networkId: '',
          }),
        },
      }),
    ).toBe(true);
  });

  it('does not clear when there is no cached cold-start context', () => {
    expect(
      shouldClearSwapSelectedTokensOnHomeAccountUpdate({
        cachedContext: undefined,
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount({
            walletId: '',
            indexedAccountId: undefined,
            othersWalletAccountId: undefined,
            networkId: '',
          }),
        },
      }),
    ).toBe(false);
  });

  it('keeps cached selected tokens when home account context is unchanged', () => {
    const activeAccount = buildActiveAccount();
    const cachedContext = buildSwapSelectedTokensColdStartContext({
      activeAccount,
      networkId: 'evm--1',
      swapType: ESwapTabSwitchType.SWAP,
      now: 1,
    });

    expect(
      shouldClearSwapSelectedTokensOnHomeAccountUpdate({
        cachedContext,
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount(),
        },
      }),
    ).toBe(false);
  });

  it('ignores non-home account selector updates', () => {
    const activeAccount = buildActiveAccount();
    const cachedContext = buildSwapSelectedTokensColdStartContext({
      activeAccount,
      networkId: 'evm--1',
      swapType: ESwapTabSwitchType.SWAP,
      now: 1,
    });

    expect(
      shouldClearSwapSelectedTokensOnHomeAccountUpdate({
        cachedContext,
        eventPayload: {
          sceneName: EAccountSelectorSceneName.swap,
          num: 0,
          selectedAccount: buildSelectedAccount({ networkId: 'btc--0' }),
        },
      }),
    ).toBe(false);
  });

  it('syncs swap account when home network changes and swap has no selected tokens', () => {
    expect(
      shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
        cachedContext: undefined,
        hasSelectedTokens: false,
        swapSelectedAccount: buildSelectedAccount({
          networkId: 'evm--1313161554',
          deriveType: 'default',
        }),
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount({
            networkId: 'btc--0',
            deriveType: 'BIP44',
          }),
        },
      }),
    ).toBe(true);
  });

  it('does not sync swap account when home and swap selected account are unchanged', () => {
    expect(
      shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
        cachedContext: undefined,
        hasSelectedTokens: false,
        swapSelectedAccount: buildSelectedAccount({
          networkId: 'btc--0',
          deriveType: 'BIP44',
        }),
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount({
            networkId: 'btc--0',
            deriveType: 'BIP44',
          }),
        },
      }),
    ).toBe(false);
  });

  it('waits for swap active network to catch up before default token sync', () => {
    expect(
      shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
        cachedContext: undefined,
        hasSelectedTokens: false,
        swapActiveNetworkId: 'btc--0',
        swapSelectedAccount: buildSelectedAccount({
          networkId: 'evm--1313161554',
          deriveType: 'default',
        }),
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount({
            networkId: 'evm--1313161554',
            deriveType: 'default',
          }),
        },
      }),
    ).toBe(true);
  });

  it('does not sync swap account from non-home account selector updates', () => {
    expect(
      shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
        cachedContext: undefined,
        hasSelectedTokens: false,
        swapSelectedAccount: buildSelectedAccount({
          networkId: 'btc--0',
          deriveType: 'BIP44',
        }),
        eventPayload: {
          sceneName: EAccountSelectorSceneName.swap,
          num: 1,
          selectedAccount: buildSelectedAccount({
            networkId: 'evm--1',
            deriveType: 'default',
          }),
        },
      }),
    ).toBe(false);
  });

  it('syncs swap account when selected token context is missing', () => {
    expect(
      shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
        cachedContext: undefined,
        hasSelectedTokens: true,
        swapSelectedAccount: buildSelectedAccount(),
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount(),
        },
      }),
    ).toBe(true);
  });

  it('syncs and clears selected tokens when swap mounts after home network changed', () => {
    const cachedContext = buildSwapSelectedTokensColdStartContext({
      activeAccount: buildActiveAccount({
        network: {
          id: 'btc--0',
        } as IAccountSelectorActiveAccountInfo['network'],
      }),
      networkId: 'btc--0',
      swapType: ESwapTabSwitchType.BRIDGE,
      now: 1,
    });

    expect(
      shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
        cachedContext,
        hasSelectedTokens: true,
        swapSelectedAccount: buildSelectedAccount({
          networkId: 'btc--0',
          deriveType: 'BIP44',
        }),
        eventPayload: {
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
          selectedAccount: buildSelectedAccount({
            networkId: 'evm--1313161554',
            deriveType: 'default',
          }),
        },
      }),
    ).toBe(true);
  });

  it('syncs swap account to home network and derive type', () => {
    expect(
      buildSwapSelectedAccountSyncedFromHome({
        homeSelectedAccount: buildSelectedAccount({
          networkId: 'btc--0',
          deriveType: 'BIP44',
          focusedWallet: 'wallet-1',
        }),
        swapSelectedAccount: buildSelectedAccount({
          networkId: 'evm--1313161554',
          deriveType: 'default',
        }),
      }),
    ).toEqual(
      buildSelectedAccount({
        networkId: 'btc--0',
        deriveType: 'BIP44',
        focusedWallet: 'wallet-1',
      }),
    );
  });
});
