import { createStore } from 'jotai';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  swapNetworks,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapStockSelectedTokenAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';

import { getSwapBackendDefaultTokensForSeed } from './swapDefaultTokenSeedUtils';
import { hydrateSwapDefaultTokensFromGlobalHomeSnapshot } from './swapRootColdStartUtils';

let mockStoredSnapshotRaw: string | undefined;

jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => ({
  readContextAtomSnapshotRaw: () => mockStoredSnapshotRaw,
  writeContextAtomSnapshotRaw: () => undefined,
}));

const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPLon',
  decimals: 18,
  isStock: true,
};

function setHomeColdStartSnapshot(networkId = 'onekeyall--0') {
  const snapshot = {
    [`store:accountSelector@home::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom}`]:
      {
        0: {
          walletId: 'wallet-1',
          indexedAccountId: 'indexed-account-1',
          deriveType: 'default',
          networkId,
        },
      },
  };
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };
  mockStoredSnapshotRaw = JSON.stringify(snapshot);
  delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
}

function clearColdStartSnapshot() {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };
  mockStoredSnapshotRaw = undefined;
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

  it('uses a configured backend pair instead of the static Home defaults', () => {
    setHomeColdStartSnapshot('evm--1');
    const store = createStore();
    const fromToken: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      decimals: 18,
    };
    const toToken: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xusdt',
      symbol: 'USDT',
      decimals: 6,
    };
    store.set(swapNetworks(), [
      {
        networkId: 'evm--1',
        name: 'Ethereum',
        symbol: 'ETH',
        defaultSelectTokenDetail: { from: fromToken, to: toToken },
      },
    ]);
    expect(hydrateSwapDefaultTokensFromGlobalHomeSnapshot(store)).toBe(true);
    expect(store.get(swapSelectToTokenAtom())?.symbol).toBe('USDT');
    expect(
      store.get(swapSelectedTokensColdStartContextAtom())?.defaultTokenSeed,
    ).toEqual({
      fromToken: { networkId: 'evm--1', contractAddress: '' },
      toToken: { networkId: 'evm--1', contractAddress: '0xusdt' },
    });
  });

  it('can reconcile an automatic fallback when backend networks arrive later', () => {
    setHomeColdStartSnapshot('evm--1');
    const store = createStore();
    expect(hydrateSwapDefaultTokensFromGlobalHomeSnapshot(store)).toBe(true);
    expect(store.get(swapSelectToTokenAtom())?.symbol).toBe('USDC');
    const context = store.get(swapSelectedTokensColdStartContextAtom());
    const fromToken = store.get(swapSelectFromTokenAtom());
    const toToken = {
      networkId: 'evm--1',
      contractAddress: '0xusdt',
      symbol: 'USDT',
      decimals: 6,
    };
    const network = {
      networkId: 'evm--1',
      name: 'Ethereum',
      symbol: 'ETH',
      defaultSelectTokenDetail: { from: fromToken, to: toToken },
    };
    const selectedAccount: IAccountSelectorSelectedAccount = {
      walletId: 'wallet-1',
      indexedAccountId: 'indexed-account-1',
      othersWalletAccountId: undefined,
      focusedWallet: 'wallet-1',
      deriveType: 'default',
      networkId: 'evm--1',
    };
    const next = getSwapBackendDefaultTokensForSeed({
      selectedAccount,
      cachedContext: context,
      currentContext: context,
      fromToken,
      toToken: store.get(swapSelectToTokenAtom()),
      swapNetworks: [network],
      preserveSelectedTokens: false,
    });
    expect(next?.toToken?.symbol).toBe('USDT');
    expect(
      getSwapBackendDefaultTokensForSeed({
        selectedAccount,
        cachedContext: context,
        currentContext: context,
        fromToken,
        toToken: store.get(swapSelectToTokenAtom()),
        swapNetworks: [network],
        preserveSelectedTokens: true,
      }),
    ).toBeUndefined();
    expect(
      getSwapBackendDefaultTokensForSeed({
        selectedAccount,
        cachedContext: context
          ? { ...context, defaultTokenSeed: undefined }
          : undefined,
        currentContext: context,
        fromToken,
        toToken: store.get(swapSelectToTokenAtom()),
        swapNetworks: [network],
        preserveSelectedTokens: false,
      }),
    ).toBeUndefined();
  });
});
