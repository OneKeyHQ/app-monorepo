import type { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
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
  toToken: ISwapToken;
  swapType: ESwapTabSwitchType;
};

function isSameSwapToken(left?: ISwapToken, right?: ISwapToken) {
  if (!left || !right) {
    return false;
  }
  return (
    left.networkId === right.networkId &&
    Boolean(left.isNative) === Boolean(right.isNative) &&
    equalsIgnoreCase(left.contractAddress, right.contractAddress)
  );
}

function resolveDefaultSwapPayToken(token: ISwapToken) {
  const defaults = swapDefaultSetTokens[token.networkId];
  if (!defaults) {
    return undefined;
  }
  if (
    !token.isNative &&
    defaults.fromToken &&
    !isSameSwapToken(defaults.fromToken, token)
  ) {
    return defaults.fromToken;
  }
  if (
    token.isNative &&
    defaults.toToken &&
    !isSameSwapToken(defaults.toToken, token)
  ) {
    return defaults.toToken;
  }
  return undefined;
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
}: {
  token: ISwapToken;
}): IPreparedMarketSwapEntry {
  const store = jotaiContextStore.prepareStoreForImmediateUse({
    storeName: EJotaiContextStoreNames.swap,
  });
  const stockToken = token.isStock ? token : { ...token, isStock: true };
  const fromToken = store.get(swapSelectFromTokenAtom());
  const nextFromToken = fromToken?.isStock ? undefined : fromToken;

  // A previous stock on the sell side would keep the stock form on that token.
  // A payment token stays so the stock tab can reuse it.
  if (fromToken?.isStock) {
    store.set(swapSelectFromTokenAtom(), undefined);
  }
  store.set(swapSelectToTokenAtom(), stockToken);
  store.set(swapStockSelectedTokenAtom(), stockToken);
  // The stock form prefers the last execution pair over the selected token.
  store.set(swapStockExecutionTokensAtom(), undefined);
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
  return {
    fromToken: nextFromToken,
    toToken: stockToken,
    swapType: ESwapTabSwitchType.STOCK,
  };
}

export function prepareTopCoinSwapEntry({
  token,
}: {
  token: ISwapToken;
}): IPreparedMarketSwapEntry {
  const store = jotaiContextStore.prepareStoreForImmediateUse({
    storeName: EJotaiContextStoreNames.swap,
  });
  const fromToken = store.get(swapSelectFromTokenAtom());
  const previousToToken = store.get(swapSelectToTokenAtom());
  let nextFromToken = fromToken;
  if (!fromToken || fromToken.isStock || isSameSwapToken(fromToken, token)) {
    nextFromToken =
      previousToToken &&
      !previousToToken.isStock &&
      !isSameSwapToken(previousToToken, token)
        ? previousToToken
        : undefined;
  }
  if (!nextFromToken) {
    nextFromToken = resolveDefaultSwapPayToken(token);
  }
  const swapType =
    nextFromToken?.networkId && nextFromToken.networkId !== token.networkId
      ? ESwapTabSwitchType.BRIDGE
      : ESwapTabSwitchType.SWAP;
  store.set(swapSelectFromTokenAtom(), nextFromToken);
  store.set(swapSelectToTokenAtom(), token);
  if (!isSameSwapToken(previousToToken, token)) {
    store.set(swapFromTokenAmountAtom(), EMPTY_SWAP_TOKEN_AMOUNT);
    store.set(swapToTokenAmountAtom(), EMPTY_SWAP_TOKEN_AMOUNT);
  }
  store.set(swapTypeSwitchAtom(), swapType);
  return {
    fromToken: nextFromToken,
    toToken: token,
    swapType,
  };
}
