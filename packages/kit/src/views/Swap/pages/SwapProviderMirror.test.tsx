/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapToTokenAmountAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { prepareTopCoinSwapEntry } from '../../../states/jotai/contexts/swap/prepareSwapProEntry';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
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
      prepareTopCoinSwapEntry({ direction: 'from', storeName, token });
      const store = jotaiContextStore.getOrCreateStore({ storeName });
      store.set(swapFromTokenAmountAtom(), { value: '12', isInput: true });
      store.set(swapToTokenAmountAtom(), { value: '24', isInput: false });
      const entry = prepareTopCoinSwapEntry({
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
      const entry = prepareTopCoinSwapEntry({
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
