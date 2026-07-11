/** @jest-environment jsdom */

import { createElement } from 'react';

import { render, waitFor } from '@testing-library/react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { ESwapProJumpTokenDirection } from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapProDirectionAtom,
  swapProSelectTokenAtom,
  swapProTradeTypeAtom,
  swapQuoteActionLockAtom,
  swapQuoteListAtom,
  swapQuoteRequestIdAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedFromTokenBalanceAtom,
  swapSelectedTokensColdStartContextAtom,
  swapSpeedQuoteRequestIdAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

import { prepareSwapProEntryState } from './swapProEntryState';

const mockCancelFetchQuoteEvents = jest.fn<Promise<void>, []>();
const mockCancelFetchSpeedSwapQuote = jest.fn<Promise<void>, []>();
const mockSetSwapProSelectToken = jest.fn<Promise<void>, [ISwapToken]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      cancelFetchQuoteEvents: () => mockCancelFetchQuoteEvents(),
      cancelFetchSpeedSwapQuote: () => mockCancelFetchSpeedSwapQuote(),
    },
    simpleDb: {
      swapNetworksSort: {
        setRawData: jest.fn().mockResolvedValue(undefined),
      },
      swapProSelectToken: {
        setSwapProSelectToken: (token: ISwapToken) =>
          mockSetSwapProSelectToken(token),
      },
    },
  },
}));

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

const stockToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xstock',
  symbol: 'STOCK',
  decimals: 18,
  isNative: false,
  isStock: true,
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('prepareSwapProEntryState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCancelFetchQuoteEvents.mockResolvedValue(undefined);
    mockCancelFetchSpeedSwapQuote.mockResolvedValue(undefined);
    mockSetSwapProSelectToken.mockResolvedValue(undefined);
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
    expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
    expect(store.get(swapSelectedTokensColdStartContextAtom())).toBeUndefined();
  });

  it('publishes the Market handoff as one Jotai transaction', () => {
    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    store.set(swapProDirectionAtom(), ESwapDirection.SELL);
    store.set(swapProSelectTokenAtom(), oldToken);
    const snapshots: Array<{
      direction: ESwapDirection;
      token?: ISwapToken;
      type: ESwapTabSwitchType;
    }> = [];
    const recordSnapshot = () => {
      snapshots.push({
        direction: store.get(swapProDirectionAtom()),
        token: store.get(swapProSelectTokenAtom()),
        type: store.get(swapTypeSwitchAtom()),
      });
    };
    const subscriptions = [
      store.sub(swapTypeSwitchAtom(), recordSnapshot),
      store.sub(swapProDirectionAtom(), recordSnapshot),
      store.sub(swapProSelectTokenAtom(), recordSnapshot),
    ];

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });
    subscriptions.forEach((unsubscribe) => unsubscribe());

    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots).toEqual(
      snapshots.map(() => ({
        direction: ESwapDirection.BUY,
        token: nextToken,
        type: ESwapTabSwitchType.LIMIT,
      })),
    );
  });

  it('clears Stock-only state while preserving an ordinary native amount', () => {
    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
    store.set(swapSelectToTokenAtom(), ordinaryToToken);
    store.set(swapFromTokenAmountAtom(), { value: '1', isInput: true });

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '1',
      isInput: true,
    });

    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
    store.set(swapSelectFromTokenAtom(), ordinaryToToken);
    store.set(swapSelectToTokenAtom(), stockToken);
    store.set(swapStockSelectedTokenAtom(), stockToken);
    store.set(swapSelectedFromTokenBalanceAtom(), '99');
    store.set(swapFromTokenAmountAtom(), { value: '2', isInput: true });
    store.set(swapToTokenAmountAtom(), { value: '20', isInput: false });
    store.set(swapSelectedTokensColdStartContextAtom(), {
      accountKey: 'stock-account',
      networkId: stockToken.networkId,
      swapType: ESwapTabSwitchType.STOCK,
      updatedAt: 1,
    });
    store.set(swapInitialSelectedTokensSyncedAtom(), true);

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.SELL,
    });

    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapSelectedFromTokenBalanceAtom())).toBe('');
    expect(store.get(swapSelectedTokensColdStartContextAtom())).toBeUndefined();
    expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
  });

  it('repairs legacy Limit state that still owns a Stock selection', () => {
    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    store.set(swapProDirectionAtom(), ESwapDirection.BUY);
    store.set(swapProSelectTokenAtom(), nextToken);
    store.set(swapSelectFromTokenAtom(), ordinaryToToken);
    store.set(swapSelectToTokenAtom(), stockToken);
    store.set(swapStockSelectedTokenAtom(), stockToken);
    store.set(swapFromTokenAmountAtom(), { value: '2', isInput: true });
    store.set(swapToTokenAmountAtom(), { value: '20', isInput: false });
    store.set(swapSelectedTokensColdStartContextAtom(), {
      accountKey: 'legacy-stock-account',
      networkId: stockToken.networkId,
      swapType: ESwapTabSwitchType.STOCK,
      updatedAt: 1,
    });

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });

    const repairedTokens = [
      store.get(swapSelectFromTokenAtom()),
      store.get(swapSelectToTokenAtom()),
    ].filter(Boolean);
    expect(repairedTokens).not.toContainEqual(stockToken);
    expect(repairedTokens.every((token) => !token?.isStock)).toBe(true);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapSelectedTokensColdStartContextAtom())).toBeUndefined();
    expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
  });

  it('drops a stale Stock context without replacing a valid ordinary pair', async () => {
    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    const activeQuote = { quoteId: 'active' } as IFetchQuoteResult;
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    store.set(swapProDirectionAtom(), ESwapDirection.BUY);
    store.set(swapProSelectTokenAtom(), nextToken);
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
    store.set(swapSelectToTokenAtom(), ordinaryToToken);
    store.set(swapStockSelectedTokenAtom(), stockToken);
    store.set(swapFromTokenAmountAtom(), { value: '1', isInput: true });
    store.set(swapToTokenAmountAtom(), { value: '10', isInput: false });
    store.set(swapQuoteListAtom(), [activeQuote]);
    store.set(swapQuoteRequestIdAtom(), 7);
    store.set(swapSpeedQuoteRequestIdAtom(), 9);
    store.set(swapSelectedTokensColdStartContextAtom(), {
      accountKey: 'stale-stock-context',
      networkId: stockToken.networkId,
      swapType: ESwapTabSwitchType.STOCK,
      updatedAt: 1,
    });

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });
    await Promise.resolve();

    expect(store.get(swapSelectFromTokenAtom())).toBe(ordinaryFromToken);
    expect(store.get(swapSelectToTokenAtom())).toBe(ordinaryToToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '1',
      isInput: true,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '10',
      isInput: false,
    });
    expect(store.get(swapSelectedTokensColdStartContextAtom())).toBeUndefined();
    expect(store.get(swapInitialSelectedTokensSyncedAtom())).toBe(true);
    expect(store.get(swapQuoteListAtom())).toEqual([activeQuote]);
    expect(store.get(swapQuoteRequestIdAtom())).toBe(7);
    expect(store.get(swapSpeedQuoteRequestIdAtom())).toBe(9);
    expect(mockCancelFetchQuoteEvents).not.toHaveBeenCalled();
    expect(mockCancelFetchSpeedSwapQuote).not.toHaveBeenCalled();
  });

  it('keeps an active quote when the mounted child consumes the same handoff', async () => {
    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    const activeQuote = { quoteId: 'active' } as IFetchQuoteResult;
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    store.set(swapProDirectionAtom(), ESwapDirection.BUY);
    store.set(swapProSelectTokenAtom(), nextToken);
    store.set(swapQuoteListAtom(), [activeQuote]);
    store.set(swapQuoteActionLockAtom(), { actionLock: true });
    store.set(swapQuoteRequestIdAtom(), 7);
    store.set(swapSpeedQuoteRequestIdAtom(), 9);

    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });
    await Promise.resolve();

    expect(store.get(swapQuoteListAtom())).toEqual([activeQuote]);
    expect(store.get(swapQuoteActionLockAtom())).toEqual({ actionLock: true });
    expect(store.get(swapQuoteRequestIdAtom())).toBe(7);
    expect(store.get(swapSpeedQuoteRequestIdAtom())).toBe(9);
    expect(mockCancelFetchQuoteEvents).not.toHaveBeenCalled();
    expect(mockCancelFetchSpeedSwapQuote).not.toHaveBeenCalled();
  });

  it('serializes consecutive handoff persistence and stores stable token fields', async () => {
    const firstWrite = createDeferred<void>();
    mockSetSwapProSelectToken
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValue(undefined);
    const oldTokenWithRealtimeFields: ISwapToken = {
      ...oldToken,
      accountAddress: '0xaccount',
      balanceParsed: '1',
      fiatValue: '2',
      price: '3',
      reservationValue: '4',
    };

    prepareSwapProEntryState({
      token: oldTokenWithRealtimeFields,
      direction: ESwapProJumpTokenDirection.BUY,
    });
    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.SELL,
    });

    await waitFor(() =>
      expect(mockSetSwapProSelectToken).toHaveBeenCalledTimes(1),
    );
    expect(mockSetSwapProSelectToken).toHaveBeenNthCalledWith(1, oldToken);

    firstWrite.resolve();
    await waitFor(() =>
      expect(mockSetSwapProSelectToken).toHaveBeenCalledTimes(2),
    );
    expect(mockSetSwapProSelectToken).toHaveBeenNthCalledWith(2, nextToken);
  });

  it('keeps the handoff usable when a queued persistence write fails', async () => {
    mockSetSwapProSelectToken
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValue(undefined);

    prepareSwapProEntryState({
      token: oldToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });
    prepareSwapProEntryState({
      token: nextToken,
      direction: ESwapProJumpTokenDirection.SELL,
    });

    await waitFor(() =>
      expect(mockSetSwapProSelectToken).toHaveBeenCalledTimes(2),
    );
    expect(mockSetSwapProSelectToken).toHaveBeenNthCalledWith(2, nextToken);

    const store = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });
    expect(store.get(swapProSelectTokenAtom())).toBe(nextToken);
    expect(store.get(swapProDirectionAtom())).toBe(ESwapDirection.SELL);
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
