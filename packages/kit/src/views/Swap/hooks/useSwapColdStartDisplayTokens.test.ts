import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { getSwapColdStartDisplayTokensFromGlobalSnapshot } from './useSwapColdStartDisplayTokens';

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
