import { createStore } from 'jotai';

import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapStockSelectedTokenAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';

import { hydrateSwapDefaultTokensFromGlobalHomeSnapshot } from './swapRootColdStartUtils';

const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPLon',
  decimals: 18,
  isStock: true,
};

function setHomeColdStartSnapshot() {
  const snapshot = {
    [`store:accountSelector@home::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom}`]:
      {
        0: {
          walletId: 'wallet-1',
          indexedAccountId: 'indexed-account-1',
          deriveType: 'default',
          networkId: 'onekeyall--0',
        },
      },
  };
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_COLD_START_CACHE_MAP__?: Map<string, unknown>;
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };
  globalCache.__ONEKEY_COLD_START_CACHE_MAP__ = new Map([
    [EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot, snapshot],
  ]);
  delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
}

function clearColdStartSnapshot() {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_COLD_START_CACHE_MAP__?: Map<string, unknown>;
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };
  delete globalCache.__ONEKEY_COLD_START_CACHE_MAP__;
  delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
}

describe('hydrateSwapDefaultTokensFromGlobalHomeSnapshot', () => {
  afterEach(clearColdStartSnapshot);

  it('keeps the Stock display seed while hydrating ordinary Swap defaults', () => {
    setHomeColdStartSnapshot();
    const store = createStore();
    store.set(swapStockSelectedTokenAtom(), stockToken);
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);

    expect(hydrateSwapDefaultTokensFromGlobalHomeSnapshot(store)).toBe(true);
    expect(store.get(swapSelectFromTokenAtom())?.symbol).toBe('ETH');
    expect(store.get(swapSelectToTokenAtom())?.symbol).toBe('USDC');
    expect(store.get(swapStockSelectedTokenAtom())).toBe(stockToken);
  });
});
