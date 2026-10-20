/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type { ISwapInputAmountDraft } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { prepareMarketSwapEntry } from '../../../states/jotai/contexts/swap/prepareSwapProEntry';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { buildMarketEmbeddedSwapInitParams } from '../../Market/MarketDetailV2/layouts/marketEmbeddedSwapUtils';
import { getLatestHomeSelectedAccount } from '../utils/swapHomeSelectedAccountUtils';

import { SwapProviderMirror } from './SwapProviderMirror';
import { SwapModalRootProvider } from './SwapRootProvider';

jest.mock('../../../states/jotai/contexts/swap', () =>
  jest.requireActual<
    typeof import('../../../states/jotai/contexts/swap/atoms')
  >('../../../states/jotai/contexts/swap/atoms'),
);

jest.mock('../../../states/jotai/utils/JotaiContextStoreMirrorTracker', () => ({
  JotaiContextStoreMirrorTracker: () => null,
}));

jest.mock('../utils/swapHomeSelectedAccountUtils', () => ({
  getLatestHomeSelectedAccount: jest.fn().mockResolvedValue(undefined),
}));

describe('Market modal initial token selection', () => {
  afterEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
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
