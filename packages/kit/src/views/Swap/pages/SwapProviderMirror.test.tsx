/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  swapInitialSelectedTokensSyncedAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
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
