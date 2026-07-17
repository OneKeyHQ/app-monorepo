import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  getSwapColdStartDisplayTokensFromGlobalSnapshot,
  getSwapDefaultSelectedTokensFromGlobalHomeSnapshot,
  getSwapDisplayTokenPair,
  getSwapStockColdStartAccountKeyFromGlobalSnapshot,
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

function setGlobalRawSnapshot(snapshot: Record<string, unknown>) {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_COLD_START_CACHE_MAP__?: Map<string, unknown>;
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  globalCache.__ONEKEY_COLD_START_CACHE_MAP__ = new Map([
    [
      EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
      JSON.stringify(snapshot),
    ],
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

function setGlobalSnapshotCandidates({
  contextSnapshot,
  rawSnapshot,
}: {
  contextSnapshot: Record<string, unknown>;
  rawSnapshot: Record<string, unknown>;
}) {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_COLD_START_CACHE_MAP__?: Map<string, unknown>;
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  globalCache.__ONEKEY_COLD_START_CACHE_MAP__ = new Map([
    [EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot, rawSnapshot],
  ]);
  globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = contextSnapshot;
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

function buildSelectedTokenSnapshot({
  fromToken,
  networkId,
  toToken,
}: {
  fromToken?: Partial<ISwapToken>;
  networkId: string;
  toToken?: Partial<ISwapToken>;
}) {
  return {
    [scopedKey(
      ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
    )]: {
      0: buildHomeSelectedAccount(networkId),
    },
    [scopedKey(
      SWAP_STORE_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
    )]: {
      accountKey: 'wallet-1|indexed-account-1|default',
      networkId,
      swapType: ESwapTabSwitchType.SWAP,
      updatedAt: 1,
    } satisfies ISwapSelectedTokensColdStartContext,
    ...(fromToken
      ? {
          [scopedKey(
            SWAP_STORE_SCOPE_KEY,
            CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
          )]: fromToken,
        }
      : undefined),
    ...(toToken
      ? {
          [scopedKey(
            SWAP_STORE_SCOPE_KEY,
            CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
          )]: toToken,
        }
      : undefined),
  };
}

function buildStockOwnerSnapshot({
  contextAccountKey = 'wallet-1|indexed-account-1|default',
  snapshotSwapType = ESwapTabSwitchType.STOCK,
}: {
  contextAccountKey?: string;
  snapshotSwapType?: ESwapTabSwitchType;
} = {}) {
  const networkId = 'evm--56';
  return {
    [scopedKey(
      ACCOUNT_SELECTOR_HOME_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom,
    )]: {
      0: {
        ready: true,
        wallet: { id: 'wallet-1' },
        indexedAccount: { id: 'indexed-account-1' },
        deriveType: 'default',
        network: { id: networkId },
      },
    },
    [scopedKey(
      SWAP_STORE_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
    )]: {
      accountKey: contextAccountKey,
      networkId,
      swapType: ESwapTabSwitchType.STOCK,
      updatedAt: 1,
    } satisfies ISwapSelectedTokensColdStartContext,
    [scopedKey(
      SWAP_STORE_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
    )]: snapshotSwapType,
    [scopedKey(
      SWAP_STORE_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
    )]: { networkId, symbol: 'USDC' },
    [scopedKey(
      SWAP_STORE_SCOPE_KEY,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
    )]: { networkId, symbol: 'AAPL', isStock: true },
  };
}

describe('getSwapColdStartDisplayTokensFromGlobalSnapshot', () => {
  afterEach(() => {
    clearGlobalSnapshot();
  });

  it('resolves the Stock owner from the validated raw pre-read snapshot', () => {
    setGlobalRawSnapshot(buildStockOwnerSnapshot());

    expect(getSwapStockColdStartAccountKeyFromGlobalSnapshot()).toBe(
      'wallet-1|indexed-account-1|default',
    );
  });

  it('rejects a raw Stock owner that does not match the persisted account', () => {
    setGlobalRawSnapshot(
      buildStockOwnerSnapshot({
        contextAccountKey: 'wallet-2|indexed-account-2|default',
      }),
    );

    expect(getSwapStockColdStartAccountKeyFromGlobalSnapshot()).toBeUndefined();
  });

  it('rejects a Stock owner when the persisted visible tab is no longer Stock', () => {
    setGlobalRawSnapshot(
      buildStockOwnerSnapshot({
        snapshotSwapType: ESwapTabSwitchType.SWAP,
      }),
    );

    expect(getSwapStockColdStartAccountKeyFromGlobalSnapshot()).toBeUndefined();
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

  it('rejects a partial selected-token pair', () => {
    setGlobalSnapshot(
      buildSelectedTokenSnapshot({
        networkId: 'custom--1',
        fromToken: {
          networkId: 'custom--1',
          symbol: 'FROM_ONLY',
        },
      }),
    );

    expect(getSwapColdStartDisplayTokensFromGlobalSnapshot()).toEqual({});
  });

  it('never combines opposite sides from different snapshot candidates', () => {
    setGlobalSnapshotCandidates({
      rawSnapshot: buildSelectedTokenSnapshot({
        networkId: 'custom--1',
        fromToken: {
          networkId: 'custom--1',
          symbol: 'FIRST_FROM',
        },
      }),
      contextSnapshot: buildSelectedTokenSnapshot({
        networkId: 'custom--2',
        toToken: {
          networkId: 'custom--2',
          symbol: 'SECOND_TO',
        },
      }),
    });

    expect(getSwapColdStartDisplayTokensFromGlobalSnapshot()).toEqual({});
  });

  it('skips a partial candidate and returns the next complete pair intact', () => {
    setGlobalSnapshotCandidates({
      rawSnapshot: buildSelectedTokenSnapshot({
        networkId: 'custom--1',
        fromToken: {
          networkId: 'custom--1',
          symbol: 'FIRST_FROM',
        },
      }),
      contextSnapshot: buildSelectedTokenSnapshot({
        networkId: 'custom--2',
        fromToken: {
          networkId: 'custom--2',
          symbol: 'SECOND_FROM',
        },
        toToken: {
          networkId: 'custom--2',
          symbol: 'SECOND_TO',
        },
      }),
    });

    expect(getSwapColdStartDisplayTokensFromGlobalSnapshot()).toEqual({
      fromToken: expect.objectContaining({
        networkId: 'custom--2',
        symbol: 'SECOND_FROM',
      }),
      toToken: expect.objectContaining({
        networkId: 'custom--2',
        symbol: 'SECOND_TO',
      }),
    });
  });
});

describe('getSwapDisplayTokenPair', () => {
  const bootPair = {
    fromToken: { networkId: 'evm--1', symbol: 'BOOT_FROM' } as ISwapToken,
    toToken: { networkId: 'evm--1', symbol: 'BOOT_TO' } as ISwapToken,
  };
  const liveFrom = {
    networkId: 'sol--101',
    symbol: 'LIVE_FROM',
  } as ISwapToken;
  const liveTo = {
    networkId: 'sol--101',
    symbol: 'LIVE_TO',
  } as ISwapToken;

  it('keeps one complete boot pair while current-launch selection is pending', () => {
    expect(
      getSwapDisplayTokenPair({
        coldStartTokens: bootPair,
        fromToken: liveFrom,
        initialSelectedTokensSynced: false,
        toToken: undefined,
      }),
    ).toEqual(bootPair);
  });

  it('does not combine a live side with the opposite boot side', () => {
    expect(
      getSwapDisplayTokenPair({
        coldStartTokens: { toToken: bootPair.toToken },
        fromToken: liveFrom,
        initialSelectedTokensSynced: false,
      }),
    ).toEqual({});
  });

  it('switches atomically to the current-launch live pair after sync', () => {
    expect(
      getSwapDisplayTokenPair({
        coldStartTokens: bootPair,
        fromToken: liveFrom,
        initialSelectedTokensSynced: true,
        toToken: liveTo,
      }),
    ).toEqual({ fromToken: liveFrom, toToken: liveTo });
  });

  it('never backfills a missing live side from the boot pair after sync', () => {
    expect(
      getSwapDisplayTokenPair({
        coldStartTokens: bootPair,
        fromToken: liveFrom,
        initialSelectedTokensSynced: true,
      }),
    ).toEqual({ fromToken: liveFrom, toToken: undefined });
  });
});
