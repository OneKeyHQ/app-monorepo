import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  getSwapBalanceDisplayEntryFromGlobalSnapshot,
  getSwapColdStartDisplayTokensFromGlobalSnapshot,
  getSwapDefaultSelectedTokensFromGlobalHomeSnapshot,
  getSwapStockColdStartDisplayTokenFromGlobalSnapshot,
  resolveSwapDisplayToken,
} from './useSwapColdStartDisplayTokens';

const SWAP_STORE_SCOPE_KEY = 'store:swap';
const ACCOUNT_SELECTOR_HOME_SCOPE_KEY = 'store:accountSelector@home';

function scopedKey(scopeKey: string, cacheKey: string) {
  return `${scopeKey}::${cacheKey}`;
}

function setGlobalSnapshot(snapshot: Record<string, unknown>) {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_COLD_START_CACHE_MAP__?: Map<string, unknown>;
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  globalCache.__ONEKEY_COLD_START_CACHE_MAP__ = new Map([
    [EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot, snapshot],
  ]);
  globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = undefined;
}

function setGlobalContextSnapshot(snapshot: Record<string, unknown>) {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_COLD_START_CACHE_MAP__?: Map<string, unknown>;
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  delete globalCache.__ONEKEY_COLD_START_CACHE_MAP__;
  globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = snapshot;
}

function clearGlobalSnapshot() {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_COLD_START_CACHE_MAP__?: Map<string, unknown>;
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  delete globalCache.__ONEKEY_COLD_START_CACHE_MAP__;
  delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
}

function buildHomeSelectedAccount(networkId: string) {
  return {
    walletId: 'wallet-1',
    indexedAccountId: 'indexed-account-1',
    networkId,
    deriveType: 'default',
  };
}

describe('getSwapColdStartDisplayTokensFromGlobalSnapshot', () => {
  afterEach(() => {
    clearGlobalSnapshot();
  });

  it('uses home-network defaults when no selected token snapshot exists yet', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('sol--101'),
      },
    });

    expect(getSwapColdStartDisplayTokensFromGlobalSnapshot()).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'sol--101',
        symbol: 'SOL',
      }),
      toToken: expect.objectContaining({
        networkId: 'sol--101',
        symbol: 'USDC',
      }),
    });
  });

  it('restores an owner-scoped balance directly from the boot snapshot', () => {
    const accountKey = 'wallet-1|indexed-account-1|default';
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('evm--1'),
      },
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )]: {
        accountKey,
        networkId: 'evm--1',
        swapType: ESwapTabSwitchType.SWAP,
        updatedAt: 1,
      } satisfies ISwapSelectedTokensColdStartContext,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
      )]: {
        networkId: 'evm--1',
        contractAddress: '',
        isNative: true,
        symbol: 'ETH',
      } satisfies Partial<ISwapToken>,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapBalanceDisplayCacheAtom,
      )]: {
        version: 1,
        entries: [
          {
            accountAddress: '0xAccount',
            accountKey,
            balance: '0.24',
            contractAddress: '',
            isNative: true,
            networkId: 'evm--1',
            updatedAt: 1,
          },
        ],
      },
    });

    const token = {
      networkId: 'evm--1',
      contractAddress: '',
      isNative: true,
      symbol: 'ETH',
    } as ISwapToken;
    expect(
      getSwapBalanceDisplayEntryFromGlobalSnapshot({ token })?.balance,
    ).toBe('0.24');
    expect(
      getSwapBalanceDisplayEntryFromGlobalSnapshot({
        currentAccountKey: 'wallet-1|indexed-account-1|',
        token,
      })?.balance,
    ).toBe('0.24');
    expect(
      getSwapBalanceDisplayEntryFromGlobalSnapshot({
        currentAccountKey: 'wallet-2|indexed-account-2|default',
        token,
      }),
    ).toBeUndefined();
  });

  it('exposes all-networks home defaults for provider cold-start bootstrap', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('onekeyall--0'),
      },
    });

    expect(
      getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
        allNetworksOnly: true,
      }),
    ).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'ETH',
      }),
      toToken: expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'USDC',
      }),
      context: expect.objectContaining({
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'onekeyall--0',
        swapType: ESwapTabSwitchType.SWAP,
      }),
      swapType: ESwapTabSwitchType.SWAP,
    });
  });

  it('reads all-networks home defaults from the pre-read context snapshot', () => {
    setGlobalContextSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('onekeyall--0'),
      },
    });

    expect(
      getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
        allNetworksOnly: true,
      }),
    ).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'ETH',
      }),
      toToken: expect.objectContaining({
        networkId: 'evm--1',
        symbol: 'USDC',
      }),
      context: expect.objectContaining({
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'onekeyall--0',
        swapType: ESwapTabSwitchType.SWAP,
      }),
      swapType: ESwapTabSwitchType.SWAP,
    });
  });

  it('does not expose single-network defaults when the bootstrap is all-networks only', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('sol--101'),
      },
    });

    expect(
      getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
        allNetworksOnly: true,
      }),
    ).toBeUndefined();
  });

  it('falls back to home-network defaults when stale selected tokens are invalidated', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('sol--101'),
      },
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )]: {
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'evm--1',
        swapType: ESwapTabSwitchType.SWAP,
        updatedAt: 1,
      } satisfies ISwapSelectedTokensColdStartContext,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
      )]: {
        networkId: 'evm--1',
        symbol: 'ETH',
      } satisfies Partial<ISwapToken>,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
      )]: {
        networkId: 'evm--1',
        symbol: 'USDC',
      } satisfies Partial<ISwapToken>,
    });

    expect(getSwapColdStartDisplayTokensFromGlobalSnapshot()).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'sol--101',
        symbol: 'SOL',
      }),
      toToken: expect.objectContaining({
        networkId: 'sol--101',
        symbol: 'USDC',
      }),
    });
  });
});

describe('getSwapStockColdStartDisplayTokenFromGlobalSnapshot', () => {
  const stockToken = {
    networkId: 'evm--56',
    contractAddress: '0xstock',
    decimals: 18,
    isNative: false,
    isStock: true,
    symbol: 'AAPLon',
  } satisfies Partial<ISwapToken>;

  afterEach(() => {
    clearGlobalSnapshot();
  });

  it('reads a persisted display seed after the boot snapshot was cleaned up', () => {
    setGlobalSnapshot({
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      )]: stockToken,
    });

    expect(getSwapStockColdStartDisplayTokenFromGlobalSnapshot()).toEqual(
      stockToken,
    );
  });

  it('keeps the display-only stock seed when execution context is stale', () => {
    setGlobalSnapshot({
      [scopedKey(
        ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )]: {
        0: buildHomeSelectedAccount('sol--101'),
      },
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )]: {
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'evm--1',
        swapType: ESwapTabSwitchType.SWAP,
        updatedAt: 1,
      } satisfies ISwapSelectedTokensColdStartContext,
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      )]: stockToken,
    });

    expect(getSwapStockColdStartDisplayTokenFromGlobalSnapshot()).toEqual(
      stockToken,
    );
  });

  it('rejects an invalid stock display seed', () => {
    setGlobalSnapshot({
      [scopedKey(
        SWAP_STORE_SCOPE_KEY,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      )]: {
        ...stockToken,
        isStock: false,
      },
    });

    expect(
      getSwapStockColdStartDisplayTokenFromGlobalSnapshot(),
    ).toBeUndefined();
  });
});

describe('resolveSwapDisplayToken', () => {
  const cachedEthToken = {
    networkId: 'evm--1',
    contractAddress: '',
    decimals: 18,
    isNative: true,
    symbol: 'ETH',
    logoURI: 'https://example.com/eth.png',
  } satisfies ISwapToken;

  it('keeps presentation fields while the same token is rehydrated', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        currentToken: {
          networkId: 'evm--1',
          contractAddress: '',
          decimals: 18,
          isNative: true,
          symbol: 'ETH',
        },
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('fills missing presentation fields from the matching cold-start token', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        currentToken: {
          networkId: 'evm--1',
          contractAddress: '',
          decimals: 18,
          isNative: true,
          symbol: 'ETH',
          logoURI: '',
        },
        fallbackToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('keeps the cached token visible across the initial selection gap', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: true,
        fallbackToken: cachedEthToken,
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('keeps the previous display token when no global fallback is available', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: true,
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('drops the cached token after initial selection has settled', () => {
    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        fallbackToken: cachedEthToken,
        previousDisplayToken: cachedEthToken,
      }),
    ).toBeUndefined();
  });

  it('does not leak presentation fields into a different token', () => {
    const solToken = {
      networkId: 'sol--101',
      contractAddress: '',
      decimals: 9,
      isNative: true,
      symbol: 'SOL',
    } satisfies ISwapToken;

    expect(
      resolveSwapDisplayToken({
        allowFallback: false,
        currentToken: solToken,
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(solToken);
  });

  it('keeps the modal display token when the global fallback belongs to another store', () => {
    const btcToken = {
      networkId: 'btc--0',
      contractAddress: '',
      decimals: 8,
      isNative: true,
      symbol: 'BTC',
    } satisfies ISwapToken;

    expect(
      resolveSwapDisplayToken({
        allowFallback: true,
        fallbackToken: btcToken,
        previousDisplayToken: cachedEthToken,
      }),
    ).toEqual(cachedEthToken);
  });

  it('uses the global fallback before the current surface has rendered a token', () => {
    const btcToken = {
      networkId: 'btc--0',
      contractAddress: '',
      decimals: 8,
      isNative: true,
      symbol: 'BTC',
    } satisfies ISwapToken;

    expect(
      resolveSwapDisplayToken({
        allowFallback: true,
        fallbackToken: btcToken,
      }),
    ).toEqual(btcToken);
  });
});
