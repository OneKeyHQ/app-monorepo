/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapDefaultConfigStatusAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';

import { SwapRootProvider } from './SwapRootProvider';

let mockSnapshotRaw: string | undefined;

const mockHomeSelectedAccount = {
  walletId: 'wallet-1',
  indexedAccountId: 'account-1',
  deriveType: 'default',
  networkId: 'evm--1',
};

jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => ({
  readContextAtomSnapshotRaw: () => mockSnapshotRaw,
  writeContextAtomSnapshotRaw: jest.fn(),
}));

jest.mock('../utils/swapHomeSelectedAccountUtils', () => ({
  getLatestHomeSelectedAccount: jest.fn(async () => mockHomeSelectedAccount),
}));

const fromToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
};
const toToken = {
  networkId: 'evm--1',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};
const automaticContext: ISwapSelectedTokensColdStartContext = {
  accountKey: 'wallet-1|account-1|default',
  networkId: 'evm--1',
  swapType: ESwapTabSwitchType.SWAP,
  updatedAt: 1,
  defaultTokenSeed: { fromToken, toToken },
};

function setSnapshot(context: ISwapSelectedTokensColdStartContext) {
  const globalCache = globalThis as typeof globalThis & {
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };
  const snapshot = {
    [`store:accountSelector@home::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom}`]:
      { 0: mockHomeSelectedAccount },
    [`store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom}`]:
      fromToken,
    [`store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom}`]:
      toToken,
    [`store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom}`]:
      context,
  };
  globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = snapshot;
  mockSnapshotRaw = JSON.stringify(snapshot);
}

describe.each(['native main', 'desktop single runtime'])(
  '%s root cold start',
  (runtime) => {
    const originalNative = platformEnv.isNative;
    const originalDesktop = platformEnv.isDesktop;

    beforeEach(() => {
      platformEnv.isNative = runtime === 'native main';
      platformEnv.isDesktop = runtime === 'desktop single runtime';
    });

    afterEach(() => {
      platformEnv.isNative = originalNative;
      platformEnv.isDesktop = originalDesktop;
      jotaiContextStore.storeCache.clear();
      jotaiContextStore.storeResetRequests.clear();
      mockSnapshotRaw = undefined;
      delete (
        globalThis as typeof globalThis & {
          __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
        }
      ).__ONEKEY_CTX_ATOM_SNAPSHOT__;
    });

    it('clears persisted automatic defaults before the Provider can restore them', async () => {
      setSnapshot(automaticContext);
      const view = render(<SwapRootProvider />);
      const store = jotaiContextStore.getOrCreateStore({
        storeName: EJotaiContextStoreNames.swap,
      });

      expect(store.get(swapDefaultConfigStatusAtom())).toBe('pending');
      expect(store.get(swapSelectFromTokenAtom())).toBeUndefined();
      expect(store.get(swapSelectToTokenAtom())).toBeUndefined();
      expect(
        store.get(swapSelectedTokensColdStartContextAtom()),
      ).toBeUndefined();
      expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(false);

      // A later Provider for the same store must not replay the persisted pair.
      const mirror = render(<ProviderJotaiContextSwap store={store} />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(store.get(swapSelectFromTokenAtom())).toBeUndefined();
      expect(store.get(swapSelectToTokenAtom())).toBeUndefined();
      expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(false);
      mirror.unmount();
      view.unmount();
    });

    it('preserves a persisted manual selection while configuration is pending', async () => {
      const manualContext = {
        ...automaticContext,
        defaultTokenSeed: undefined,
      };
      setSnapshot(manualContext);
      const view = render(<SwapRootProvider />);
      const store = jotaiContextStore.getOrCreateStore({
        storeName: EJotaiContextStoreNames.swap,
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(store.get(swapDefaultConfigStatusAtom())).toBe('pending');
      expect(store.get(swapSelectFromTokenAtom())).toEqual(fromToken);
      expect(store.get(swapSelectToTokenAtom())).toEqual(toToken);
      expect(store.get(swapSelectedTokensColdStartContextAtom())).toEqual(
        manualContext,
      );
      view.unmount();
    });

    it('preserves a pair and amount already entered in the current store', async () => {
      setSnapshot(automaticContext);
      const store = jotaiContextStore.prepareStoreForImmediateUse({
        storeName: EJotaiContextStoreNames.swap,
      });
      store.set(swapFromTokenAmountAtom(), { value: '0.12', isInput: true });
      const view = render(<SwapRootProvider />);
      await act(async () => {
        await Promise.resolve();
      });

      expect(store.get(swapDefaultConfigStatusAtom())).toBe('pending');
      expect(store.get(swapSelectFromTokenAtom())).toEqual(fromToken);
      expect(store.get(swapSelectToTokenAtom())).toEqual(toToken);
      expect(store.get(swapFromTokenAmountAtom())).toEqual({
        value: '0.12',
        isInput: true,
      });
      view.unmount();
    });
  },
);
