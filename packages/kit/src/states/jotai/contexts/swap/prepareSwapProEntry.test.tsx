/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from '../../utils/jotaiContextStore';

import {
  ProviderJotaiContextSwap,
  swapFromTokenAmountAtom,
  swapProDirectionAtom,
  swapProSelectTokenAtom,
  swapProUserSelectedTokenAtom,
  swapQuoteActionLockAtom,
  swapQuoteListAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapStockExecutionTokensAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
  useSwapFromTokenAmountAtom,
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from './atoms';
import {
  prepareStockSwapEntry,
  prepareSwapProEntry,
  prepareTopCoinSwapEntry,
} from './prepareSwapProEntry';

type IGlobalColdStartSnapshot = typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
};

const swapStoreData = {
  storeName: EJotaiContextStoreNames.swap,
};
const swapModalStoreData = {
  storeName: EJotaiContextStoreNames.swapModal,
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
const proToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xtarget',
  symbol: 'TARGET',
  decimals: 18,
  isNative: false,
};
const modalToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xmodal',
  symbol: 'MODAL',
  decimals: 18,
  isNative: false,
};

type IFirstRenderState = {
  direction: ESwapDirection;
  fromAmount: { value: string; isInput: boolean };
  fromToken?: ISwapToken;
  proToken?: ISwapToken;
  swapType: ESwapTabSwitchType;
  toAmount: { value: string; isInput: boolean };
  toToken?: ISwapToken;
};

function FirstRenderProbe({
  onRender,
}: {
  onRender: (state: IFirstRenderState) => void;
}) {
  const [swapType] = useSwapTypeSwitchAtom();
  const [direction] = useSwapProDirectionAtom();
  const [selectedProToken] = useSwapProSelectTokenAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const [toAmount] = useSwapToTokenAmountAtom();

  onRender({
    direction,
    fromAmount,
    fromToken,
    proToken: selectedProToken,
    swapType,
    toAmount,
    toToken,
  });
  return null;
}

describe('prepareSwapProEntry', () => {
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

  it('hydrates the cold snapshot before the first Provider child render and preserves ordinary Swap state', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const fromAmount = { value: '1', isInput: true };
    const toAmount = { value: '2500', isInput: false };
    const activeQuote = { quoteId: 'active-quote' } as IFetchQuoteResult;
    const activeQuotes = [activeQuote];
    const quoteLock = {
      actionLock: true,
      fromToken: ordinaryFromToken,
      toToken: ordinaryToToken,
    };
    store.set(swapFromTokenAmountAtom(), fromAmount);
    store.set(swapToTokenAmountAtom(), toAmount);
    store.set(swapQuoteListAtom(), activeQuotes);
    store.set(swapQuoteActionLockAtom(), quoteLock);

    const coldStartScopeKey = `store:${EJotaiContextStoreNames.swap}`;
    (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [`${coldStartScopeKey}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom}`]:
        ESwapTabSwitchType.SWAP,
      [`${coldStartScopeKey}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom}`]:
        ordinaryFromToken,
      [`${coldStartScopeKey}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom}`]:
        ordinaryToToken,
    };

    prepareSwapProEntry({
      direction: ESwapDirection.BUY,
      token: proToken,
    });

    const renderStates: IFirstRenderState[] = [];
    render(
      <ProviderJotaiContextSwap store={store}>
        <FirstRenderProbe
          onRender={(state) => {
            renderStates.push(state);
          }}
        />
      </ProviderJotaiContextSwap>,
    );

    expect(renderStates[0]).toEqual({
      direction: ESwapDirection.BUY,
      fromAmount,
      fromToken: ordinaryFromToken,
      proToken,
      swapType: ESwapTabSwitchType.LIMIT,
      toAmount,
      toToken: ordinaryToToken,
    });
    expect(store.get(swapQuoteListAtom())).toBe(activeQuotes);
    expect(store.get(swapQuoteActionLockAtom())).toBe(quoteLock);
  });

  it('prepares the same token again after returning to ordinary Swap state', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
    store.set(swapSelectToTokenAtom(), ordinaryToToken);
    store.set(swapFromTokenAmountAtom(), { value: '1', isInput: true });
    store.set(swapProUserSelectedTokenAtom(), proToken);

    prepareSwapProEntry({
      direction: ESwapDirection.BUY,
      token: proToken,
    });
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    store.set(swapProDirectionAtom(), ESwapDirection.SELL);

    prepareSwapProEntry({
      direction: ESwapDirection.BUY,
      token: proToken,
    });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store.get(swapProDirectionAtom())).toBe(ESwapDirection.BUY);
    expect(store.get(swapProSelectTokenAtom())).toBe(proToken);
    expect(store.get(swapSelectFromTokenAtom())).toBe(ordinaryFromToken);
    expect(store.get(swapSelectToTokenAtom())).toBe(ordinaryToToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '1',
      isInput: true,
    });
    expect(store.get(swapProUserSelectedTokenAtom())).toBeUndefined();
  });

  it('does not modify the modal Swap store', () => {
    const modalStore = jotaiContextStore.getOrCreateStore(swapModalStoreData);
    modalStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
    modalStore.set(swapProDirectionAtom(), ESwapDirection.SELL);
    modalStore.set(swapProSelectTokenAtom(), modalToken);
    modalStore.set(swapSelectFromTokenAtom(), modalToken);

    prepareSwapProEntry({
      direction: ESwapDirection.BUY,
      token: proToken,
    });

    expect(modalStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.STOCK);
    expect(modalStore.get(swapProDirectionAtom())).toBe(ESwapDirection.SELL);
    expect(modalStore.get(swapProSelectTokenAtom())).toBe(modalToken);
    expect(modalStore.get(swapSelectFromTokenAtom())).toBe(modalToken);
  });

  it('cancels a pending root-store reset before preparing the entry', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const storeId = buildJotaiContextStoreId(swapStoreData);
    jotaiContextStore.requestStoreReset(swapStoreData, store);

    prepareSwapProEntry({
      direction: ESwapDirection.SELL,
      token: proToken,
    });
    jotaiContextStore.completeStoreResetIfRequestedById(storeId);

    expect(jotaiContextStore.getStore(swapStoreData)).toBe(store);
    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(store.get(swapProDirectionAtom())).toBe(ESwapDirection.SELL);
    expect(store.get(swapProSelectTokenAtom())).toBe(proToken);
  });
});

describe('prepareStockSwapEntry', () => {
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

  it('opens the stock tab on the tapped token and drops the previous stock pair', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const previousStock: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xaapl',
      symbol: 'AAPLon',
      decimals: 18,
      isNative: false,
      isStock: true,
    };
    const nextStock: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xnvda',
      symbol: 'NVDAon',
      decimals: 18,
      isNative: false,
      isStock: true,
    };
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    store.set(swapSelectFromTokenAtom(), previousStock);
    store.set(swapSelectToTokenAtom(), ordinaryToToken);
    store.set(swapStockSelectedTokenAtom(), previousStock);
    store.set(swapStockExecutionTokensAtom(), {
      syncId: 1,
      fromToken: ordinaryToToken,
      toToken: previousStock,
    });

    prepareStockSwapEntry({ token: nextStock });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.STOCK);
    expect(store.get(swapStockSelectedTokenAtom())).toEqual(nextStock);
    expect(store.get(swapSelectToTokenAtom())).toEqual(nextStock);
    expect(store.get(swapSelectFromTokenAtom())).toBeUndefined();
    expect(store.get(swapStockExecutionTokensAtom())).toBeUndefined();
  });

  it('clears the previous amount when opening a different stock', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const previousStock: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xaapl',
      symbol: 'AAPLon',
      decimals: 18,
      isNative: false,
      isStock: true,
    };
    const nextStock: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xnvda',
      symbol: 'NVDAon',
      decimals: 18,
      isNative: false,
      isStock: true,
    };
    const previousAmount = { value: '100', isInput: true };
    store.set(swapStockSelectedTokenAtom(), previousStock);
    store.set(swapSelectFromTokenAtom(), previousStock);
    store.set(swapFromTokenAmountAtom(), previousAmount);
    store.set(swapToTokenAmountAtom(), { value: '1', isInput: false });

    prepareStockSwapEntry({ token: nextStock });

    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
  });

  it('keeps the amount when the same stock is opened again', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const nextStock: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xnvda',
      symbol: 'NVDAon',
      decimals: 18,
      isNative: false,
      isStock: true,
    };
    const previousAmount = { value: '100', isInput: true };
    store.set(swapStockSelectedTokenAtom(), nextStock);
    store.set(swapSelectFromTokenAtom(), ordinaryToToken);
    store.set(swapFromTokenAmountAtom(), previousAmount);

    prepareStockSwapEntry({ token: nextStock });

    expect(store.get(swapFromTokenAmountAtom())).toEqual(previousAmount);
  });

  it('keeps a non-stock payment token', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const nextStock: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xnvda',
      symbol: 'NVDAon',
      decimals: 18,
      isNative: false,
    };
    store.set(swapSelectFromTokenAtom(), ordinaryToToken);

    prepareStockSwapEntry({ token: nextStock });

    expect(store.get(swapSelectFromTokenAtom())).toBe(ordinaryToToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual({
      ...nextStock,
      isStock: true,
    });
    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.STOCK);
  });

  it('does not modify the modal Swap store', () => {
    const modalStore = jotaiContextStore.getOrCreateStore(swapModalStoreData);
    modalStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    modalStore.set(swapSelectToTokenAtom(), modalToken);

    prepareStockSwapEntry({ token: proToken });

    expect(modalStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(modalStore.get(swapSelectToTokenAtom())).toBe(modalToken);
  });
});

describe('prepareTopCoinSwapEntry', () => {
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

  it('opens ordinary Swap with the coin as the receive token', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const btc: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xbtc',
      symbol: 'BTC',
      decimals: 8,
      isNative: false,
    };
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
    store.set(swapSelectToTokenAtom(), ordinaryToToken);
    store.set(swapFromTokenAmountAtom(), { value: '1', isInput: true });
    store.set(swapToTokenAmountAtom(), { value: '2', isInput: false });

    prepareTopCoinSwapEntry({ token: btc });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).toBe(ordinaryFromToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(btc);
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapProSelectTokenAtom())).toBeUndefined();
  });

  it('keeps a cross-network payment token on the bridge form', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const btc: ISwapToken = {
      networkId: 'btc--0',
      contractAddress: '',
      symbol: 'BTC',
      decimals: 8,
      isNative: true,
    };
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);

    prepareTopCoinSwapEntry({ token: btc });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.BRIDGE);
    expect(store.get(swapSelectFromTokenAtom())).toBe(ordinaryFromToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(btc);
  });

  it('does not leave a stock token on the pay side', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const stock: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xaapl',
      symbol: 'AAPLon',
      decimals: 18,
      isNative: false,
      isStock: true,
    };
    const btc: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xbtc',
      symbol: 'BTC',
      decimals: 8,
      isNative: false,
    };
    store.set(swapSelectFromTokenAtom(), stock);
    store.set(swapSelectToTokenAtom(), ordinaryToToken);

    prepareTopCoinSwapEntry({ token: btc });

    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
    expect(store.get(swapSelectFromTokenAtom())).toBe(ordinaryToToken);
    expect(store.get(swapSelectToTokenAtom())).toEqual(btc);
  });

  it('clears the amount when the payment token changes and the receive token stays', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const stock: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xaapl',
      symbol: 'AAPLon',
      decimals: 18,
      isNative: false,
      isStock: true,
    };
    const btc: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xbtc',
      symbol: 'BTC',
      decimals: 8,
      isNative: false,
    };
    store.set(swapSelectFromTokenAtom(), stock);
    store.set(swapSelectToTokenAtom(), btc);
    store.set(swapFromTokenAmountAtom(), { value: '100', isInput: true });
    store.set(swapToTokenAmountAtom(), { value: '1', isInput: false });

    prepareTopCoinSwapEntry({ token: btc });

    expect(store.get(swapSelectToTokenAtom())).toEqual(btc);
    expect(store.get(swapSelectFromTokenAtom())?.isStock).toBeFalsy();
    expect(store.get(swapFromTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
    expect(store.get(swapToTokenAmountAtom())).toEqual({
      value: '',
      isInput: false,
    });
  });

  it('keeps the amount when the same pair is opened again', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const btc: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xbtc',
      symbol: 'BTC',
      decimals: 8,
      isNative: false,
    };
    const previousAmount = { value: '100', isInput: true };
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
    store.set(swapSelectToTokenAtom(), btc);
    store.set(swapFromTokenAmountAtom(), previousAmount);

    prepareTopCoinSwapEntry({ token: btc });

    expect(store.get(swapSelectFromTokenAtom())).toBe(ordinaryFromToken);
    expect(store.get(swapFromTokenAmountAtom())).toEqual(previousAmount);
  });

  it('fills the network pay token when swap has no payment token', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const btc: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xbtc',
      symbol: 'BTC',
      decimals: 8,
      isNative: false,
    };

    prepareTopCoinSwapEntry({ token: btc });

    expect(store.get(swapSelectFromTokenAtom())).toMatchObject({
      isNative: true,
      networkId: 'evm--1',
      symbol: 'ETH',
    });
    expect(store.get(swapSelectToTokenAtom())).toEqual(btc);
    expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
  });

  it('uses the default quote token as payment when the detail token is native', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);

    prepareTopCoinSwapEntry({ token: ordinaryFromToken });

    expect(store.get(swapSelectFromTokenAtom())).toMatchObject({
      networkId: 'evm--1',
      symbol: 'USDC',
    });
    expect(store.get(swapSelectToTokenAtom())).toBe(ordinaryFromToken);
  });

  it('does not modify the modal Swap store', () => {
    const modalStore = jotaiContextStore.getOrCreateStore(swapModalStoreData);
    modalStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    modalStore.set(swapSelectToTokenAtom(), modalToken);

    prepareTopCoinSwapEntry({ token: proToken });

    expect(modalStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(modalStore.get(swapSelectToTokenAtom())).toBe(modalToken);
  });
});
