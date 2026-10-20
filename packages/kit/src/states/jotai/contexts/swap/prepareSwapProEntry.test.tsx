/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
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
  prepareMarketSwapEntry as prepareMarketSwapEntryWithTokens,
  prepareStockSwapEntry,
  prepareSwapProEntry,
} from './prepareSwapProEntry';

function prepareMarketSwapEntry(
  params: Omit<
    Parameters<typeof prepareMarketSwapEntryWithTokens>[0],
    'defaultTokens'
  >,
) {
  return prepareMarketSwapEntryWithTokens({
    ...params,
    defaultTokens: [swapDefaultSetTokens['evm--1'].toToken as ISwapToken],
  });
}

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

  it('opens a stock sell with a same-network receive token and clears buy amounts', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const stockToken: ISwapToken = { ...proToken, isStock: true };
    store.set(swapSelectFromTokenAtom(), ordinaryToToken);
    store.set(swapSelectToTokenAtom(), stockToken);
    store.set(swapFromTokenAmountAtom(), { value: '123', isInput: true });
    store.set(swapToTokenAmountAtom(), { value: '5', isInput: false });
    const entry = prepareStockSwapEntry({
      token: stockToken,
      direction: 'from',
    });
    expect(entry).toEqual({
      fromToken: stockToken,
      toToken: ordinaryToToken,
      swapType: ESwapTabSwitchType.STOCK,
    });
    expect(store.get(swapSelectFromTokenAtom())).toEqual(stockToken);
    expect(store.get(swapSelectToTokenAtom())).toBe(ordinaryToToken);
    expect(store.get(swapStockSelectedTokenAtom())).toEqual(stockToken);
    expect(store.get(swapStockExecutionTokensAtom())).toBeUndefined();
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('');
    expect(store.get(swapToTokenAmountAtom()).value).toBe('');
    store.set(swapFromTokenAmountAtom(), { value: '2', isInput: true });
    prepareStockSwapEntry({ token: stockToken, direction: 'from' });
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('2');
    prepareStockSwapEntry({ token: stockToken, direction: 'to' });
    expect(store.get(swapSelectToTokenAtom())).toEqual(stockToken);
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('');
  });

  it('drops the previous network receive token when selling a new stock', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    store.set(swapSelectToTokenAtom(), ordinaryToToken);
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
    const stockToken: ISwapToken = {
      ...proToken,
      networkId: 'evm--56',
      isStock: true,
    };
    const entry = prepareStockSwapEntry({
      token: stockToken,
      direction: 'from',
    });
    expect(entry.fromToken).toEqual(stockToken);
    expect(entry.toToken).toBeUndefined();
    expect(store.get(swapSelectToTokenAtom())).toBeUndefined();
  });

  it('uses an eligible stablecoin instead of an unsupported Stock receive token', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    store.set(swapSelectToTokenAtom(), ordinaryFromToken);
    store.set(swapSelectFromTokenAtom(), ordinaryToToken);
    const stockToken = { ...proToken, isStock: true };
    const entry = prepareStockSwapEntry({
      token: stockToken,
      direction: 'from',
    });
    expect(entry.toToken).toBe(ordinaryToToken);
    expect(store.get(swapSelectToTokenAtom())).toBe(ordinaryToToken);
  });

  it('leaves Stock receive selection to the channel when no eligible token exists', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    store.set(swapSelectToTokenAtom(), ordinaryFromToken);
    store.set(swapSelectFromTokenAtom(), { ...proToken, isStock: true });
    store.set(swapFromTokenAmountAtom(), { value: '2', isInput: true });
    store.set(swapToTokenAmountAtom(), { value: '100', isInput: false });
    const entry = prepareStockSwapEntry({
      token: { ...proToken, isStock: true },
      direction: 'from',
    });
    expect(entry.toToken).toBeUndefined();
    expect(store.get(swapSelectToTokenAtom())).toBeUndefined();
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('');
    expect(store.get(swapToTokenAmountAtom()).value).toBe('');
  });

  it('preserves Stock Sell amounts when opening the same incomplete pair again', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    const stockToken = { ...proToken, isStock: true };
    prepareStockSwapEntry({ token: stockToken, direction: 'from' });
    const fromAmount = { value: '2', isInput: true };
    const toAmount = { value: '100', isInput: false };
    store.set(swapFromTokenAmountAtom(), fromAmount);
    store.set(swapToTokenAmountAtom(), toAmount);
    prepareStockSwapEntry({ token: stockToken, direction: 'from' });
    expect(store.get(swapFromTokenAmountAtom())).toBe(fromAmount);
    expect(store.get(swapToTokenAmountAtom())).toBe(toAmount);
    expect(store.get(swapSelectToTokenAtom())).toBeUndefined();
    prepareStockSwapEntry({
      token: { ...stockToken, contractAddress: '0xother-stock' },
      direction: 'from',
    });
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('');
    expect(store.get(swapToTokenAmountAtom()).value).toBe('');
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

describe('prepareMarketSwapEntry', () => {
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

  it.each(['from', 'to'] as const)(
    'resets the %s entry after a previous cross-chain trade',
    (direction) => {
      const store = jotaiContextStore.getOrCreateStore(swapStoreData);
      store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
      store.set(swapSelectToTokenAtom(), {
        ...ordinaryToToken,
        networkId: 'sol--101',
      });
      store.set(swapFromTokenAmountAtom(), { value: '123', isInput: true });
      store.set(swapToTokenAmountAtom(), { value: '2', isInput: false });
      const entry = prepareMarketSwapEntry({ token: proToken, direction });
      expect(entry).toEqual({
        fromToken:
          direction === 'from'
            ? proToken
            : swapDefaultSetTokens['evm--1'].toToken,
        toToken:
          direction === 'to'
            ? proToken
            : swapDefaultSetTokens['evm--1'].toToken,
        swapType: ESwapTabSwitchType.SWAP,
      });
      expect(store.get(swapSelectFromTokenAtom())).toEqual(entry.fromToken);
      expect(store.get(swapSelectToTokenAtom())).toEqual(entry.toToken);
      expect(store.get(swapFromTokenAmountAtom())).toEqual({
        value: '',
        isInput: false,
      });
      expect(store.get(swapToTokenAmountAtom())).toEqual({
        value: '',
        isInput: false,
      });
    },
  );

  it('keeps an amount for the same directed pair and clears it when reversing', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    prepareMarketSwapEntry({ token: proToken });
    store.set(swapFromTokenAmountAtom(), { value: '10', isInput: true });
    prepareMarketSwapEntry({ token: proToken });
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('10');
    prepareMarketSwapEntry({ token: proToken, direction: 'from' });
    expect(store.get(swapFromTokenAmountAtom()).value).toBe('');
  });

  it('uses Ethereum USDC for BTC instead of the old payment token', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    store.set(swapSelectFromTokenAtom(), ordinaryFromToken);
    const btc = { ...ordinaryFromToken, networkId: 'btc--0', symbol: 'BTC' };
    const entry = prepareMarketSwapEntry({ token: btc });
    expect(entry).toEqual({
      fromToken: swapDefaultSetTokens['evm--1'].toToken,
      toToken: btc,
      swapType: ESwapTabSwitchType.BRIDGE,
    });
  });

  it('replaces a stock payment token with the configured counterpart', () => {
    const store = jotaiContextStore.getOrCreateStore(swapStoreData);
    store.set(swapSelectFromTokenAtom(), { ...proToken, isStock: true });
    prepareMarketSwapEntry({ token: ordinaryFromToken });
    expect(store.get(swapSelectFromTokenAtom())).toBe(
      swapDefaultSetTokens['evm--1'].toToken,
    );
  });

  it('does not modify the modal Swap store', () => {
    const modalStore = jotaiContextStore.getOrCreateStore(swapModalStoreData);
    modalStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
    modalStore.set(swapSelectToTokenAtom(), modalToken);

    prepareMarketSwapEntry({ token: proToken });

    expect(modalStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    expect(modalStore.get(swapSelectToTokenAtom())).toBe(modalToken);
  });
});

describe('Market modal store preparation', () => {
  beforeEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    delete (globalThis as IGlobalColdStartSnapshot)
      .__ONEKEY_CTX_ATOM_SNAPSHOT__;
  });

  afterEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
  });

  it.each([
    { prepare: prepareMarketSwapEntry, isStock: false },
    { prepare: prepareStockSwapEntry, isStock: true },
  ])(
    'prepares a modal pair with isStock=$isStock without modifying the Trade tab',
    ({ prepare, isStock }) => {
      const tabStore = jotaiContextStore.getOrCreateStore(swapStoreData);
      tabStore.set(swapSelectFromTokenAtom(), ordinaryFromToken);
      tabStore.set(swapSelectToTokenAtom(), ordinaryToToken);
      tabStore.set(swapFromTokenAmountAtom(), { value: '42', isInput: true });
      tabStore.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
      const modalStore = jotaiContextStore.getOrCreateStore(swapModalStoreData);
      modalStore.set(swapSelectFromTokenAtom(), ordinaryToToken);
      const target = { ...proToken, isStock };
      const storeId = buildJotaiContextStoreId(swapModalStoreData);
      jotaiContextStore.requestStoreReset(swapModalStoreData, modalStore);

      const buyEntry = prepare({
        token: target,
        storeName: EJotaiContextStoreNames.swapModal,
      });
      jotaiContextStore.completeStoreResetIfRequestedById(storeId);
      expect(jotaiContextStore.getStore(swapModalStoreData)).toBe(modalStore);
      expect(buyEntry.toToken).toEqual(target);
      expect(modalStore.get(swapSelectToTokenAtom())).toEqual(target);
      modalStore.set(swapFromTokenAmountAtom(), {
        value: '123',
        isInput: true,
      });
      const sellEntry = prepare({
        token: target,
        direction: 'from',
        storeName: EJotaiContextStoreNames.swapModal,
      });
      expect(sellEntry.fromToken).toEqual(target);
      expect(modalStore.get(swapSelectFromTokenAtom())).toEqual(target);
      expect(modalStore.get(swapFromTokenAmountAtom())).toEqual({
        value: '',
        isInput: false,
      });
      expect(modalStore.get(swapTypeSwitchAtom())).toBe(
        isStock ? ESwapTabSwitchType.STOCK : ESwapTabSwitchType.SWAP,
      );
      if (isStock) {
        expect(modalStore.get(swapStockSelectedTokenAtom())).toEqual(target);
        expect(modalStore.get(swapStockExecutionTokensAtom())).toBeUndefined();
      }
      expect(tabStore.get(swapSelectFromTokenAtom())).toBe(ordinaryFromToken);
      expect(tabStore.get(swapSelectToTokenAtom())).toBe(ordinaryToToken);
      expect(tabStore.get(swapFromTokenAmountAtom())).toEqual({
        value: '42',
        isInput: true,
      });
      expect(tabStore.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.LIMIT);
    },
  );
});
