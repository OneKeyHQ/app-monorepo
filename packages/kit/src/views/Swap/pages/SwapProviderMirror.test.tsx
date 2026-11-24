/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type { ISwapInputAmountDraft } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapInputAmountDraftsAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapStockExecutionTokensAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { prepareMarketSwapEntry } from '../../../states/jotai/contexts/swap/prepareSwapProEntry';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { buildMarketEmbeddedSwapInitParams } from '../../Market/MarketDetailV2/layouts/marketEmbeddedSwapUtils';
import { getLatestHomeSelectedAccount } from '../utils/swapHomeSelectedAccountUtils';

import { SwapProviderMirror } from './SwapProviderMirror';
import { SwapModalRootProvider } from './SwapRootProvider';

jest.mock('../../../background/instance/backgroundApiProxy', () => ({}));

jest.mock('../../../states/jotai/utils/JotaiContextStoreMirrorTracker', () => ({
  JotaiContextStoreMirrorTracker: () => null,
}));

jest.mock('../utils/swapHomeSelectedAccountUtils', () => ({
  getLatestHomeSelectedAccount: jest.fn().mockResolvedValue(undefined),
}));

describe('Market modal initial token selection', () => {
  it('keeps Tab, More and inline token selections in separate scoped caches', () => {
    const tab = jotaiContextStore.prepareStoreForImmediateUse({
      storeName: EJotaiContextStoreNames.swap,
    });
    const more = jotaiContextStore.prepareStoreForImmediateUse({
      storeName: EJotaiContextStoreNames.swapHomeMore,
    });
    const inline = jotaiContextStore.prepareStoreForImmediateUse({
      storeName: EJotaiContextStoreNames.swapHomeToken,
    });
    const token = { networkId: 'evm--1', contractAddress: '', decimals: 18 };
    tab.set(swapSelectFromTokenAtom(), { ...token, symbol: 'TAB' });
    more.set(swapSelectFromTokenAtom(), { ...token, symbol: 'MORE' });
    more.set(swapSelectedTokensColdStartContextAtom(), {
      accountKey: 'wallet-1|account-1|default',
      networkId: 'evm--1',
      swapType: ESwapTabSwitchType.SWAP,
      updatedAt: 1,
      defaultTokenSeed: { fromToken: token },
    });
    inline.set(swapSelectFromTokenAtom(), { ...token, symbol: 'INLINE' });
    const view = render(
      <SwapProviderMirror storeName={EJotaiContextStoreNames.swapHomeMore} />,
    );
    expect(tab.get(swapSelectFromTokenAtom())?.symbol).toBe('TAB');
    expect(more.get(swapSelectFromTokenAtom())?.symbol).toBe('MORE');
    expect(inline.get(swapSelectFromTokenAtom())?.symbol).toBe('INLINE');
    view.unmount();
    const reopened = render(
      <SwapProviderMirror
        storeName={EJotaiContextStoreNames.swapHomeMore}
        homeSelectedAccountOnInit={{
          walletId: 'wallet-1',
          indexedAccountId: 'account-1',
          deriveType: 'default',
          networkId: 'onekeyall--0',
          focusedWallet: 'wallet-1',
          othersWalletAccountId: undefined,
        }}
      />,
    );
    expect(more.get(swapSelectFromTokenAtom())).toBeUndefined();
    expect(tab.get(swapSelectFromTokenAtom())?.symbol).toBe('TAB');
    expect(inline.get(swapSelectFromTokenAtom())?.symbol).toBe('INLINE');
    reopened.unmount();
  });

  it('keeps a manual selection when another Mirror mounts before initialization finishes', () => {
    const storeName = EJotaiContextStoreNames.swapModal;
    const store = jotaiContextStore.getOrCreateStore({ storeName });
    const selectedAccount = {
      walletId: 'wallet-1',
      indexedAccountId: 'account-1',
      networkId: 'evm--1',
      deriveType: 'default',
    };
    const globalCache = globalThis as typeof globalThis & {
      __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
    };
    globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [`store:accountSelector@home::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom}`]:
        { 0: selectedAccount },
      [`store:accountSelector@swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom}`]:
        { 0: selectedAccount },
    };
    const manualToken = {
      networkId: 'evm--1',
      contractAddress: '0xmanual',
      symbol: 'MANUAL',
      decimals: 18,
    };
    store.set(swapSelectFromTokenAtom(), manualToken);
    store.set(swapSelectedTokensColdStartContextAtom(), {
      accountKey: 'wallet-1|account-1|default',
      networkId: 'evm--1',
      updatedAt: 1,
    });
    store.set(swapInitialSelectedTokensSyncedAtom(), false);
    const view = render(<SwapProviderMirror storeName={storeName} />);
    expect(store.get(swapSelectFromTokenAtom())).toBe(manualToken);
    expect(store.get(swapSelectToTokenAtom())).toBeUndefined();
    expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(false);
    view.unmount();
    delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
  });

  afterEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
  });

  it('opens a network-only Market modal in Swap without replacing the saved pair or amount', () => {
    const storeName = EJotaiContextStoreNames.swapModal;
    const store = jotaiContextStore.getOrCreateStore({ storeName });
    const { fromToken, toToken } = swapDefaultSetTokens['evm--1'];
    const amount = { value: '0.5', isInput: true };
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    store.set(swapSelectFromTokenAtom(), fromToken);
    store.set(swapSelectToTokenAtom(), toToken);
    store.set(swapFromTokenAmountAtom(), amount);

    render(<SwapProviderMirror storeName={storeName} defaultToSwapOnInit />);

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).toEqual(fromToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(toToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual(amount);
  });

  it('keeps a stock sale quantity out of a network-only Market Swap entry', () => {
    const storeName = EJotaiContextStoreNames.swapModal;
    const store = jotaiContextStore.getOrCreateStore({ storeName });
    const stock = {
      networkId: 'evm--1',
      contractAddress: '0xaapl',
      symbol: 'AAPLx',
      decimals: 18,
      isStock: true,
    };
    const sellAmount = { value: '12', isInput: true };
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
    store.set(swapSelectFromTokenAtom(), stock);
    store.set(swapSelectToTokenAtom(), swapDefaultSetTokens['evm--1'].toToken);
    store.set(swapFromTokenAmountAtom(), sellAmount);

    render(<SwapProviderMirror storeName={storeName} defaultToSwapOnInit />);

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).toBeUndefined();
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('');
    expect(
      store.get(swapInputAmountDraftsAtom())[ESwapTabSwitchType.STOCK]
        ?.fromTokenAmount,
    ).toEqual(sellAmount);
  });

  it.each([ESwapTabSwitchType.STOCK, ESwapTabSwitchType.LIMIT])(
    'resets a reused %s modal before an asset entry initializes',
    (previousType) => {
      const storeName = EJotaiContextStoreNames.swapModal;
      const store = jotaiContextStore.getOrCreateStore({ storeName });
      store.set(swapTypeSwitchAtom(), previousType);
      const sol = {
        networkId: 'sol--101',
        contractAddress: '',
        symbol: 'SOL',
        decimals: 9,
        isNative: true,
      };
      const view = render(
        <SwapProviderMirror
          storeName={storeName}
          initialSelectedTokensOnInit={{
            fromToken: sol,
            swapType: ESwapTabSwitchType.SWAP,
          }}
        />,
      );
      expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
      expect(store.get(swapSelectFromTokenAtom())).toEqual(sol);
      view.unmount();
    },
  );

  it('keeps 0.1 BTC attached to BTC when an embedded bridge draft remounts', () => {
    const storeName = EJotaiContextStoreNames.marketSwap;
    const btc = {
      networkId: 'btc--0',
      contractAddress: '',
      symbol: 'BTC',
      decimals: 8,
      isNative: true,
    };
    const usdc = swapDefaultSetTokens['evm--1'].toToken;
    const first = render(
      <SwapProviderMirror
        storeName={storeName}
        initialSelectedTokensOnInit={{
          fromToken: usdc,
          toToken: btc,
          swapType: ESwapTabSwitchType.BRIDGE,
        }}
      />,
    );
    const store = jotaiContextStore.getOrCreateStore({ storeName });
    act(() => {
      store.set(swapSelectFromTokenAtom(), btc);
      store.set(swapSelectToTokenAtom(), usdc);
      store.set(swapFromTokenAmountAtom(), { value: '0.1', isInput: true });
    });
    const inputDraft: ISwapInputAmountDraft = {
      fromToken: store.get(swapSelectFromTokenAtom()),
      toToken: store.get(swapSelectToTokenAtom()),
      fromTokenAmount: store.get(swapFromTokenAmountAtom()),
      toTokenAmount: store.get(swapToTokenAmountAtom()),
    };
    first.unmount();

    const entry = buildMarketEmbeddedSwapInitParams({
      defaultTokens: [],
      inputDraft,
      swapToken: btc,
    });
    const reopened = render(
      <SwapProviderMirror
        storeName={storeName}
        initialSelectedTokensOnInit={{
          fromToken: entry?.importFromToken,
          toToken: entry?.importToToken,
          swapType: entry?.swapTabSwitchType,
          inputAmountDraft: inputDraft,
        }}
      />,
    );

    expect(store.get(swapSelectFromTokenAtom())).toEqual(btc);
    expect(store.get(swapSelectToTokenAtom())).toEqual(usdc);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '0.1',
      isInput: true,
    });
    reopened.unmount();
  });

  it.each([false, true])(
    'preserves amounts only for the same pair (changed=%s)',
    (changed) => {
      const storeName = EJotaiContextStoreNames.swapModal;
      const token = {
        networkId: 'evm--1',
        contractAddress: '0xmarket',
        symbol: 'MARKET',
        decimals: 18,
      };
      prepareMarketSwapEntry({
        defaultTokens: [swapDefaultSetTokens['evm--1'].toToken!],
        direction: 'from',
        storeName,
        token,
      });
      const store = jotaiContextStore.getOrCreateStore({ storeName });
      store.set(swapFromTokenAmountAtom(), { value: '12', isInput: true });
      store.set(swapToTokenAmountAtom(), { value: '24', isInput: false });
      const entry = prepareMarketSwapEntry({
        defaultTokens: [swapDefaultSetTokens['evm--1'].toToken!],
        direction: 'from',
        storeName,
        token: changed ? { ...token, contractAddress: '0xother' } : token,
      });
      const view = render(
        <SwapProviderMirror
          storeName={storeName}
          initialSelectedTokensOnInit={{ ...entry, preserveInputAmounts: true }}
        />,
      );
      expect(store.get(swapFromTokenAmountAtom()).value).toBe(
        changed ? '' : '12',
      );
      expect(store.get(swapToTokenAmountAtom()).value).toBe(
        changed ? '' : '24',
      );
      view.unmount();
    },
  );

  it.each(['from', 'to'] as const)(
    'preserves an entered amount when reopening the same incomplete pair with %s missing',
    (missingSide) => {
      const storeName = EJotaiContextStoreNames.swapModal;
      const token = {
        networkId: 'evm--1',
        contractAddress: '0xmarket',
        symbol: 'MARKET',
        decimals: 18,
      };
      const entry = {
        fromToken: missingSide === 'from' ? undefined : token,
        toToken: missingSide === 'to' ? undefined : token,
        preserveInputAmounts: true,
      };
      const first = render(
        <SwapProviderMirror
          storeName={storeName}
          initialSelectedTokensOnInit={entry}
        />,
      );
      const store = jotaiContextStore.getOrCreateStore({ storeName });
      store.set(swapFromTokenAmountAtom(), { value: '12', isInput: true });
      store.set(swapToTokenAmountAtom(), { value: '24', isInput: false });
      first.unmount();
      const reopened = render(
        <SwapProviderMirror
          storeName={storeName}
          initialSelectedTokensOnInit={entry}
        />,
      );
      expect(store.get(swapFromTokenAmountAtom())).toEqual({
        value: '12',
        isInput: true,
      });
      expect(store.get(swapToTokenAmountAtom())).toEqual({
        value: '24',
        isInput: false,
      });
      reopened.unmount();
    },
  );

  it('replaces a previous stock Buy execution pair when opening a Sell fallback', () => {
    const storeName = EJotaiContextStoreNames.swapModal;
    const store = jotaiContextStore.getOrCreateStore({ storeName });
    const payToken = {
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
    };
    const stockToken = {
      networkId: 'evm--1',
      contractAddress: '0xstock',
      symbol: 'STOCK',
      decimals: 18,
      isStock: true,
    };
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
    store.set(swapSelectFromTokenAtom(), payToken);
    store.set(swapSelectToTokenAtom(), stockToken);
    store.set(swapStockExecutionTokensAtom(), {
      syncId: 1,
      fromToken: payToken,
      toToken: stockToken,
    });

    render(
      <SwapProviderMirror
        storeName={storeName}
        initialSelectedTokensOnInit={{
          fromToken: stockToken,
          toToken: payToken,
          swapType: ESwapTabSwitchType.STOCK,
          preserveInputAmounts: true,
        }}
      />,
    );

    expect(store.get(swapStockExecutionTokensAtom())).toBeUndefined();
    expect(store.get(swapSelectFromTokenAtom())).toEqual(stockToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(payToken);
  });

  it('clears both amounts and the saved draft for a same-pair stock Max fallback', () => {
    const storeName = EJotaiContextStoreNames.swapModal;
    const store = jotaiContextStore.getOrCreateStore({ storeName });
    const swapType = ESwapTabSwitchType.STOCK;
    const fromToken = swapDefaultSetTokens['evm--1'].fromToken;
    const toToken = {
      networkId: 'evm--1',
      contractAddress: '0xstock',
      symbol: 'STOCK',
      decimals: 18,
      isStock: true,
    };
    const fromTokenAmount = { value: '12', isInput: true };
    const toTokenAmount = { value: '24', isInput: false };
    const draft = { fromToken, toToken, fromTokenAmount, toTokenAmount };
    store.set(swapTypeSwitchAtom(), swapType);
    store.set(swapSelectFromTokenAtom(), fromToken);
    store.set(swapSelectToTokenAtom(), toToken);
    store.set(swapFromTokenAmountAtom(), fromTokenAmount);
    store.set(swapToTokenAmountAtom(), toTokenAmount);
    store.set(swapInputAmountDraftsAtom(), {
      [swapType]: draft,
      [ESwapTabSwitchType.SWAP]: draft,
    });

    render(
      <SwapProviderMirror
        storeName={storeName}
        initialSelectedTokensOnInit={{
          fromToken,
          toToken,
          swapType,
          preserveInputAmounts: true,
          clearInputAmounts: true,
        }}
      />,
    );

    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapInputAmountDraftsAtom())[swapType]).toBeUndefined();
    expect(
      store.get(swapInputAmountDraftsAtom())[ESwapTabSwitchType.SWAP],
    ).toBe(draft);
  });

  it.each(['from', 'to'] as const)(
    'keeps the %s trade pair after the no-wallet cold-start read completes',
    async (direction) => {
      const storeName = EJotaiContextStoreNames.swapModal;
      const entry = prepareMarketSwapEntry({
        defaultTokens: [swapDefaultSetTokens['evm--1'].toToken!],
        direction,
        storeName,
        token: {
          networkId: 'evm--1',
          contractAddress: '0xmarket',
          symbol: 'MARKET',
          decimals: 18,
        },
      });
      const store = jotaiContextStore.getOrCreateStore({ storeName });

      const view = render(
        <>
          <SwapModalRootProvider />
          <SwapProviderMirror
            storeName={storeName}
            initialSelectedTokensOnInit={entry}
          />
        </>,
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(getLatestHomeSelectedAccount).toHaveBeenCalled();
      expect(store.get(swapSelectFromTokenAtom())).toEqual(entry.fromToken);
      expect(store.get(swapSelectToTokenAtom())).toEqual(entry.toToken);
      expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
      view.unmount();
    },
  );
});
