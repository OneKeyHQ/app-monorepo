import orderBy from 'lodash/orderBy';

import { filterSwapHistoryPendingList } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  isPrivateSendSwapHistoryItem,
  isStockSwapHistoryItem,
} from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import { maxRecentTokenPairs } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

export type ISwapRecentTokenPair = {
  fromToken: ISwapToken;
  toToken: ISwapToken;
};

export function isSwapMarketHistoryItem(item: ISwapTxHistory) {
  return (
    item.protocol !== EProtocolOfExchange.LIMIT &&
    !isPrivateSendSwapHistoryItem(item)
  );
}

// Re-exported from shared so the history clear logic (kit-bg) reuses the exact
// same stock detection as the list display.
export { isStockSwapHistoryItem };

// Maps a swap-history type to its modal title translation id. Shared by the
// history modal header and its lazy-load fallback so the two never drift.
export function getSwapHistoryListTitleId(
  type?: EProtocolOfExchange,
): ETranslations {
  if (type === EProtocolOfExchange.STOCK) {
    return ETranslations.perps_token_selector_stocks;
  }
  if (type === EProtocolOfExchange.LIMIT) {
    return ETranslations.swap_page_limit_dialog_title;
  }
  return ETranslations.swap_history_title;
}

function matchSwapMarketHistoryProtocol({
  item,
  protocol,
}: {
  item: ISwapTxHistory;
  protocol?: EProtocolOfExchange;
}) {
  if (protocol === EProtocolOfExchange.LIMIT) {
    return false;
  }
  if (!isSwapMarketHistoryItem(item)) {
    return false;
  }
  if (protocol === EProtocolOfExchange.STOCK) {
    return item.protocol === EProtocolOfExchange.STOCK;
  }
  return true;
}

export function filterSwapMarketHistoryItems({
  items,
  protocol,
}: {
  items: ISwapTxHistory[];
  protocol?: EProtocolOfExchange;
}) {
  return items.filter((item) =>
    matchSwapMarketHistoryProtocol({ item, protocol }),
  );
}

export function getSwapMarketPendingHistoryList(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
  protocol?: EProtocolOfExchange,
) {
  return filterSwapHistoryPendingList(swapHistoryPendingList).filter(
    (item) =>
      matchSwapMarketHistoryProtocol({ item, protocol }) &&
      (item.status === ESwapTxHistoryStatus.PENDING ||
        item.status === ESwapTxHistoryStatus.CANCELING),
  );
}

export function getSwapMarketPendingHistoryCount(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
  protocol?: EProtocolOfExchange,
) {
  return getSwapMarketPendingHistoryList(swapHistoryPendingList, protocol)
    .length;
}

export function getSwapMarketPendingHistoryKey(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
  protocol?: EProtocolOfExchange,
) {
  return getSwapMarketPendingHistoryList(swapHistoryPendingList, protocol)
    .map((item) => {
      const id = item.txInfo.useOrderId
        ? (item.txInfo.orderId ?? '')
        : (item.txInfo.txId ?? '');
      return `${id}:${item.status}`;
    })
    .join('|');
}

function getRecentTokenPairKey({ fromToken, toToken }: ISwapRecentTokenPair) {
  const buildTokenKey = (token: ISwapToken) =>
    `${token.networkId}:${token.contractAddress ?? ''}:${
      token.isNative ? 'native' : 'token'
    }`;
  return `${buildTokenKey(fromToken)}->${buildTokenKey(toToken)}`;
}

function buildSwapRecentTokenBaseInfo(token: ISwapToken): ISwapToken {
  return {
    networkId: token.networkId,
    contractAddress: token.contractAddress,
    symbol: token.symbol,
    decimals: token.decimals,
    name: token.name,
    logoURI: token.logoURI,
    networkLogoURI: token.networkLogoURI,
    isNative: token.isNative,
    isStock: token.isStock,
  };
}

export function buildSwapRecentTokenPairsFromHistory({
  items,
  protocol,
  maxCount = maxRecentTokenPairs,
}: {
  items: ISwapTxHistory[];
  protocol?: EProtocolOfExchange;
  maxCount?: number;
}): ISwapRecentTokenPair[] {
  const recentTokenPairs: ISwapRecentTokenPair[] = [];
  const seenKeys = new Set<string>();
  const histories = orderBy(
    filterSwapMarketHistoryItems({ items, protocol }),
    (item) => item.date.created,
    'desc',
  );

  for (const item of histories) {
    const pair = {
      fromToken: buildSwapRecentTokenBaseInfo(item.baseInfo.fromToken),
      toToken: buildSwapRecentTokenBaseInfo(item.baseInfo.toToken),
    };
    const pairKey = getRecentTokenPairKey(pair);
    if (!seenKeys.has(pairKey)) {
      seenKeys.add(pairKey);
      recentTokenPairs.push(pair);
      if (recentTokenPairs.length >= maxCount) {
        break;
      }
    }
  }

  return recentTokenPairs;
}
