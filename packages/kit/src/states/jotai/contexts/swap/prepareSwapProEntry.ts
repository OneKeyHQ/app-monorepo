import type { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { filterStockPayTokenCandidates } from '@onekeyhq/kit/src/views/Swap/hooks/swapStockChannelUtils';
import { getMarketSwapDefaultPair } from '@onekeyhq/kit/src/views/Swap/utils/marketSwapDefaultPair';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { jotaiContextStore } from '../../utils/jotaiContextStore';

import {
  swapFromTokenAmountAtom,
  swapProDirectionAtom,
  swapProSelectTokenAtom,
  swapProUserSelectedTokenAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapStockExecutionTokensAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
} from './atoms';

const EMPTY_SWAP_TOKEN_AMOUNT = { value: '', isInput: false } as const;

export type IPreparedMarketSwapEntry = {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  swapType: ESwapTabSwitchType;
};

function isSameSwapToken(left?: ISwapToken, right?: ISwapToken) {
  if (!left || !right) {
    return left === right;
  }
  return (
    left.networkId === right.networkId &&
    Boolean(left.isNative) === Boolean(right.isNative) &&
    equalsIgnoreCase(left.contractAddress, right.contractAddress)
  );
}

export function prepareSwapProEntry({
  direction,
  token,
}: {
  direction: ESwapDirection;
  token: ISwapToken;
}) {
  const store = jotaiContextStore.prepareStoreForImmediateUse({
    storeName: EJotaiContextStoreNames.swap,
  });

  // Keep ordinary Swap state intact. The pending global intent remains the
  // owner of persistence and Market preset consumption after navigation.
  store.set(swapProUserSelectedTokenAtom(), undefined);
  store.set(swapProSelectTokenAtom(), token);
  store.set(swapProDirectionAtom(), direction);
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
}

export function prepareStockSwapEntry({
  token,
  direction = 'to',
  storeName = EJotaiContextStoreNames.swap,
}: {
  token: ISwapToken;
  direction?: 'from' | 'to';
  storeName?: EJotaiContextStoreNames.swap | EJotaiContextStoreNames.swapModal;
}): IPreparedMarketSwapEntry {
  const store = jotaiContextStore.prepareStoreForImmediateUse({
    storeName,
  });
  const stockToken = token.isStock ? token : { ...token, isStock: true };
  const fromToken = store.get(swapSelectFromTokenAtom());
  if (direction === 'from') {
    const toToken = store.get(swapSelectToTokenAtom());
    const nextToToken = [toToken, fromToken].find(
      (candidate) =>
        candidate &&
        filterStockPayTokenCandidates([candidate]).length > 0 &&
        !candidate.isStock &&
        candidate.networkId === stockToken.networkId &&
        !isSameSwapToken(candidate, stockToken),
    );
    store.set(swapSelectFromTokenAtom(), stockToken);
    store.set(swapSelectToTokenAtom(), nextToToken);
    store.set(swapStockSelectedTokenAtom(), stockToken);
    if (
      !isSameSwapToken(fromToken, stockToken) ||
      !isSameSwapToken(toToken, nextToToken)
    ) {
      store.set(swapFromTokenAmountAtom(), EMPTY_SWAP_TOKEN_AMOUNT);
      store.set(swapToTokenAmountAtom(), EMPTY_SWAP_TOKEN_AMOUNT);
    }
    store.set(swapStockExecutionTokensAtom(), undefined);
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
    return {
      fromToken: stockToken,
      toToken: nextToToken,
      swapType: ESwapTabSwitchType.STOCK,
    };
  }
  const previousStockToken = store.get(swapStockSelectedTokenAtom());
  const nextFromToken = fromToken?.isStock ? undefined : fromToken;
  const stockChanged = !isSameSwapToken(previousStockToken, stockToken);
  const droppedStockPayToken = Boolean(fromToken?.isStock);

  // A previous stock on the sell side would keep the stock form on that token.
  // A payment token stays so the stock tab can reuse it.
  if (droppedStockPayToken) {
    store.set(swapSelectFromTokenAtom(), undefined);
  }
  store.set(swapSelectToTokenAtom(), stockToken);
  store.set(swapStockSelectedTokenAtom(), stockToken);
  // Selling the previous stock leaves its share count on the pay side. After
  // the channel fills USDC, that count would quote as USDC. A different stock
  // also must not inherit the previous purchase amount.
  if (stockChanged || droppedStockPayToken) {
    store.set(swapFromTokenAmountAtom(), EMPTY_SWAP_TOKEN_AMOUNT);
    store.set(swapToTokenAmountAtom(), EMPTY_SWAP_TOKEN_AMOUNT);
  }
  // The stock form prefers the last execution pair over the selected token.
  store.set(swapStockExecutionTokensAtom(), undefined);
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
  return {
    fromToken: nextFromToken,
    toToken: stockToken,
    swapType: ESwapTabSwitchType.STOCK,
  };
}

export function prepareMarketSwapEntry({
  token,
  direction = 'to',
  storeName = EJotaiContextStoreNames.swap,
}: {
  token: ISwapToken;
  direction?: 'from' | 'to';
  storeName?: EJotaiContextStoreNames.swap | EJotaiContextStoreNames.swapModal;
}): IPreparedMarketSwapEntry {
  const store = jotaiContextStore.prepareStoreForImmediateUse({
    storeName,
  });
  const fromToken = store.get(swapSelectFromTokenAtom());
  const toToken = store.get(swapSelectToTokenAtom());
  const {
    fromToken: nextFromToken,
    toToken: nextToToken,
    swapType,
  } = getMarketSwapDefaultPair({ token, direction });
  store.set(swapSelectFromTokenAtom(), nextFromToken);
  store.set(swapSelectToTokenAtom(), nextToToken);
  // Amounts belong to the complete directed pair, including the trade side.
  if (
    !isSameSwapToken(toToken, nextToToken) ||
    !isSameSwapToken(fromToken, nextFromToken)
  ) {
    store.set(swapFromTokenAmountAtom(), EMPTY_SWAP_TOKEN_AMOUNT);
    store.set(swapToTokenAmountAtom(), EMPTY_SWAP_TOKEN_AMOUNT);
  }
  store.set(swapTypeSwitchAtom(), swapType);
  return { fromToken: nextFromToken, toToken: nextToToken, swapType };
}
