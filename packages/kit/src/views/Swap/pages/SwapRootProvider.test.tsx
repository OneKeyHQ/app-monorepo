/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { purgeOldColdStartRuntimeKeys } from '@onekeyhq/kit-bg/src/states/jotai/utils';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapDefaultConfigStatusAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapNetworkConfigStatusAtom,
  swapNetworks,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapTokenMapAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import {
  SWAP_TOKEN_SELECTOR_SCOPE,
  getSwapTokenSelectorStore,
} from '../../../states/jotai/contexts/swap/tokenSelectorData';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';

import { SwapModalRootProvider, SwapRootProvider } from './SwapRootProvider';

let mockSnapshotRaw: string | undefined;

const mockHomeSelectedAccount: IAccountSelectorSelectedAccount = {
  walletId: 'wallet-1',
  indexedAccountId: 'account-1',
  deriveType: 'default',
  networkId: 'evm--1',
  focusedWallet: 'wallet-1',
  othersWalletAccountId: undefined,
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
    [`store:accountSelector@swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom}`]:
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
      mockHomeSelectedAccount.networkId = 'evm--1';
      platformEnv.isNative = runtime === 'native main';
      platformEnv.isDesktop = runtime === 'desktop single runtime';
      purgeOldColdStartRuntimeKeys(
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom,
      );
      purgeOldColdStartRuntimeKeys(
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom,
      );
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

    it('preserves automatic defaults while configuration is pending', async () => {
      setSnapshot(automaticContext);
      const view = render(<SwapRootProvider />);
      const store = jotaiContextStore.getOrCreateStore({
        storeName: EJotaiContextStoreNames.swap,
      });

      expect(store.get(swapDefaultConfigStatusAtom())).toBe('pending');
      expect(store.get(swapSelectFromTokenAtom())).toEqual(fromToken);
      expect(store.get(swapSelectToTokenAtom())).toEqual(toToken);
      expect(store.get(swapSelectedTokensColdStartContextAtom())).toEqual(
        automaticContext,
      );
      expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(false);

      // A later Provider must keep the same defaults visible during refresh.
      const mirror = render(<ProviderJotaiContextSwap store={store} />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(store.get(swapSelectFromTokenAtom())).toEqual(fromToken);
      expect(store.get(swapSelectToTokenAtom())).toEqual(toToken);
      expect(store.get(swapSelectedTokensColdStartContextAtom())).toEqual(
        automaticContext,
      );
      expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(false);
      mirror.unmount();
      view.unmount();
    });

    it('tracks background token snapshots without mounting the selector', async () => {
      setSnapshot(automaticContext);
      const view = render(<SwapRootProvider />);
      const store = getSwapTokenSelectorStore();
      const queryKey = JSON.stringify({
        networkId: 'evm--1',
        keywords: '',
        accountId: 'account-1',
        accountAddress: '0xwallet',
      });
      await act(async () => {
        store.set(swapTokenMapAtom(), {
          version: 1,
          updatedAt: 20,
          tokenCatch: {
            [queryKey]: {
              data: [fromToken],
              updatedAt: 20,
              refreshVersion: 0,
              identityVersion: 0,
            },
          },
        });
      });
      const snapshot = (
        globalThis as typeof globalThis & {
          __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
        }
      ).__ONEKEY_CTX_ATOM_SNAPSHOT__;
      expect(
        snapshot?.[
          `${SWAP_TOKEN_SELECTOR_SCOPE}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`
        ],
      ).toEqual({
        version: 1,
        updatedAt: 20,
        tokenCatch: {
          [queryKey]: {
            data: [fromToken],
            updatedAt: 20,
            identityVersion: 0,
            persisted: true,
          },
        },
      });
      view.unmount();
    });

    it.each([true, false])(
      'uses the latest Home network only for automatic defaults=%s',
      async (automatic) => {
        mockHomeSelectedAccount.networkId = 'btc--0';
        setSnapshot({
          ...automaticContext,
          defaultTokenSeed: automatic
            ? automaticContext.defaultTokenSeed
            : undefined,
        });
        const view = render(<SwapRootProvider />);
        const store = jotaiContextStore.getOrCreateStore({
          storeName: EJotaiContextStoreNames.swap,
        });
        expect(store.get(swapSelectFromTokenAtom())?.symbol).toBe('ETH');
        await act(async () => {
          await Promise.resolve();
        });
        expect(store.get(swapSelectFromTokenAtom())?.symbol).toBe(
          automatic ? undefined : 'ETH',
        );
        expect(store.get(swapSelectToTokenAtom())?.symbol).toBe(
          automatic ? undefined : 'USDC',
        );
        view.unmount();
      },
    );

    it.each([
      'automatic pair',
      'automatic empty',
      'manual pair',
      'typed amount',
    ])(
      'uses recovered configuration only for a later Home intent with %s',
      async (selection) => {
        setSnapshot(automaticContext);
        const view = render(<SwapRootProvider />);
        const store = jotaiContextStore.getOrCreateStore({
          storeName: EJotaiContextStoreNames.swap,
        });
        await act(async () => {});
        const empty = selection === 'automatic empty';
        const automaticSeed = empty ? {} : automaticContext.defaultTokenSeed;
        const context = {
          ...automaticContext,
          networkId: empty ? 'evm--no-local-default' : 'evm--1',
          defaultTokenSeed:
            selection === 'manual pair' ? undefined : automaticSeed,
        };
        mockHomeSelectedAccount.networkId = context.networkId;
        await act(async () => {
          store.set(swapDefaultConfigStatusAtom(), 'failed');
          store.set(swapInitialSelectedTokensSyncedAtom(), true);
          store.set(swapSelectedTokensColdStartContextAtom(), context);
          if (empty) {
            store.set(swapSelectFromTokenAtom(), undefined);
            store.set(swapSelectToTokenAtom(), undefined);
          }
          if (selection === 'typed amount') {
            store.set(swapFromTokenAmountAtom(), { value: '1', isInput: true });
          }
        });
        const configuredFrom = {
          ...fromToken,
          networkId: 'evm--42161',
          contractAddress: '0xaave',
          symbol: 'AAVE',
        };
        const configuredTo = {
          ...toToken,
          networkId: 'evm--42161',
          contractAddress: '0xusdt',
          symbol: 'USDT',
        };
        await act(async () => {
          store.set(swapNetworks(), [
            {
              networkId: 'evm--42161',
              name: 'Arbitrum',
              symbol: 'ETH',
              backendIndex: true,
              supportSingleSwap: true,
              supportCrossChainSwap: false,
              supportLimit: false,
              supportStock: false,
              isDeFiEnabled: true,
              defaultSelectTokenDetail: {
                from: configuredFrom,
                to: configuredTo,
              },
            },
          ]);
          store.set(swapNetworkConfigStatusAtom(), 'success');
        });
        expect(store.get(swapSelectFromTokenAtom())).toEqual(
          empty ? undefined : fromToken,
        );
        expect(store.get(swapSelectToTokenAtom())).toEqual(
          empty ? undefined : toToken,
        );
        await act(async () => {
          mockHomeSelectedAccount.networkId = 'evm--42161';
          appEventBus.emit(
            EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
            {
              sceneName: EAccountSelectorSceneName.home,
              num: 0,
              selectedAccount: {
                ...mockHomeSelectedAccount,
                networkId: 'evm--42161',
              },
              selectedAccountUpdatedAt: Date.now(),
            },
          );
        });
        const automatic = selection.startsWith('automatic');
        expect(store.get(swapSelectFromTokenAtom())).toEqual(
          automatic ? configuredFrom : fromToken,
        );
        expect(store.get(swapSelectToTokenAtom())).toEqual(
          automatic ? configuredTo : toToken,
        );
        view.unmount();
      },
    );

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

    it('keeps automatic ownership when account initialization announces the same selection', async () => {
      setSnapshot(automaticContext);
      const view = render(<SwapRootProvider />);
      const store = jotaiContextStore.getOrCreateStore({
        storeName: EJotaiContextStoreNames.swap,
      });
      await act(async () => {
        appEventBus.emit(
          EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
          {
            sceneName: EAccountSelectorSceneName.swap,
            num: 0,
            selectedAccount: { ...mockHomeSelectedAccount },
            selectedAccountUpdatedAt: undefined,
            trigger: 'selection-effect',
          },
        );
      });
      expect(
        store.get(swapSelectedTokensColdStartContextAtom())?.defaultTokenSeed,
      ).toEqual(automaticContext.defaultTokenSeed);
      view.unmount();
    });

    it.each([undefined, 999])(
      'ignores an initialization or older account save announced after a modal seed was created (revision=%s)',
      async (revision) => {
        const store = jotaiContextStore.getOrCreateStore({
          storeName: EJotaiContextStoreNames.swapModal,
        });
        store.set(swapSelectFromTokenAtom(), fromToken);
        store.set(swapSelectToTokenAtom(), toToken);
        store.set(swapSelectedTokensColdStartContextAtom(), {
          ...automaticContext,
          updatedAt: 1000,
        });
        const view = render(<SwapModalRootProvider />);
        const event = {
          sceneName: EAccountSelectorSceneName.swap,
          num: 0,
          selectedAccount: { ...mockHomeSelectedAccount, networkId: 'btc--0' },
          selectedAccountUpdatedAt: revision,
          trigger: 'selection-effect',
        };
        await act(async () => {
          appEventBus.emit(
            EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
            event,
          );
        });
        expect(
          store.get(swapSelectedTokensColdStartContextAtom())?.defaultTokenSeed,
        ).toEqual(automaticContext.defaultTokenSeed);
        await act(async () => {
          appEventBus.emit(
            EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
            {
              ...event,
              selectedAccountUpdatedAt: 1001,
            },
          );
        });
        expect(
          store.get(swapSelectedTokensColdStartContextAtom())?.defaultTokenSeed,
        ).toBeUndefined();
        view.unmount();
      },
    );

    it.each([
      { indexedAccountId: 'another-account' },
      { networkId: 'btc--0' },
      { deriveType: 'BIP44' as const },
    ])(
      'releases automatic ownership for a changed user account selection: %j',
      async (change) => {
        setSnapshot(automaticContext);
        const view = render(<SwapRootProvider />);
        const store = jotaiContextStore.getOrCreateStore({
          storeName: EJotaiContextStoreNames.swap,
        });
        await act(async () => {
          appEventBus.emit(
            EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
            {
              sceneName: EAccountSelectorSceneName.swap,
              num: 0,
              selectedAccount: { ...mockHomeSelectedAccount, ...change },
              selectedAccountUpdatedAt: Date.now(),
            },
          );
        });
        expect(
          store.get(swapSelectedTokensColdStartContextAtom())?.defaultTokenSeed,
        ).toBeUndefined();
        view.unmount();
      },
    );

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
