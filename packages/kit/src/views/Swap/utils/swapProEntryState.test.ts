/** @jest-environment jsdom */

import { createElement } from 'react';

import { render } from '@testing-library/react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { ESwapProJumpTokenDirection } from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapFromTokenAmountAtom,
  swapProDirectionAtom,
  swapProSelectTokenAtom,
  swapProTradeTypeAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapTypeSwitchAtom,
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

import { prepareSwapProEntryState } from './swapProEntryState';

type IGlobalColdStartSnapshot = typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
};

const oldToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xold',
  symbol: 'OLD',
  decimals: 18,
  isNative: false,
};

const nextToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xnext',
  symbol: 'NEXT',
  decimals: 18,
  isNative: false,
};

const ordinaryFromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const ordinaryToToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

describe('prepareSwapProEntryState', () => {
  beforeEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    delete (globalThis as IGlobalColdStartSnapshot)
      .__ONEKEY_CTX_ATOM_SNAPSHOT__;
  });

  afterEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    delete (globalThis as IGlobalColdStartSnapshot)
      .__ONEKEY_CTX_ATOM_SNAPSHOT__;
  });

  it('prepares Pro synchronously without resetting ordinary Swap state', () => {
    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    store.set(swapProDirectionAtom(), ESwapDirection.SELL);
    store.set(swapProSelectTokenAtom(), oldToken);
    store.set(swapProTradeTypeAtom(), ESwapProTradeType.LIMIT);
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
    store.set(swapSelectToTokenAtom(), ordinaryToToken);
    store.set(swapFromTokenAmountAtom(), { value: '1', isInput: true });

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store.get(swapProDirectionAtom())).toBe(ESwapDirection.BUY);
    expect(store.get(swapProSelectTokenAtom())).toBe(nextToken);
    expect(store.get(swapProTradeTypeAtom())).toBe(ESwapProTradeType.LIMIT);
    expect(store.get(swapSelectFromTokenAtom())).toBe(ordinaryFromToken);
    expect(store.get(swapSelectToTokenAtom())).toBe(ordinaryToToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '1',
      isInput: true,
    });
  });

  it('creates the root store and maps a Sell handoff immediately', () => {
    expect(
      jotaiContextStore.getStore({
        storeName: EJotaiContextStoreNames.swap,
      }),
    ).toBeUndefined();

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.SELL,
    });

    const store = jotaiContextStore.getStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    expect(store?.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store?.get(swapProDirectionAtom())).toBe(ESwapDirection.SELL);
    expect(store?.get(swapProSelectTokenAtom())).toBe(nextToken);
  });

  it('keeps the handoff after the first Provider hydration pass', () => {
    const actualSwapRootScopeKey = `store:${EJotaiContextStoreNames.swap}`;
    (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [`${actualSwapRootScopeKey}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom}`]:
        ESwapTabSwitchType.SWAP,
    };

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });

    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    const firstPaintStates: Array<{
      direction: ESwapDirection;
      token: ISwapToken | undefined;
      type: ESwapTabSwitchType;
    }> = [];
    function FirstPaintProbe() {
      const [type] = useSwapTypeSwitchAtom();
      const [direction] = useSwapProDirectionAtom();
      const [token] = useSwapProSelectTokenAtom();
      firstPaintStates.push({ type, direction, token });
      return null;
    }

    render(
      createElement(
        ProviderJotaiContextSwap,
        { store },
        createElement(FirstPaintProbe),
      ),
    );

    expect(firstPaintStates[0]).toEqual({
      type: ESwapTabSwitchType.LIMIT,
      direction: ESwapDirection.BUY,
      token: nextToken,
    });
  });

  it('lets the latest consecutive handoff win', () => {
    prepareSwapProEntryState({
      token: oldToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });
    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.SELL,
    });

    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    expect(store.get(swapProSelectTokenAtom())).toBe(nextToken);
    expect(store.get(swapProDirectionAtom())).toBe(ESwapDirection.SELL);
    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
  });
});
