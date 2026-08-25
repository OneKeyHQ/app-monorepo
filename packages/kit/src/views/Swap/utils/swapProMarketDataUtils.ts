import { orderBy, uniqBy } from 'lodash';

import { getSwapProTransactionTokenPrice } from './swapProTransactionSource';

import type {
  ISwapProMarketDataSource,
  ISwapProMarketTransaction,
} from './swapProTransactionSource';

export type ISwapProMarketData = {
  source: ISwapProMarketDataSource | undefined;
  price: string;
  transactions: ISwapProMarketTransaction[];
  isSourceSupported: boolean;
  hasLoadedSource: boolean;
};

export const SWAP_PRO_TRANSACTION_LIMIT = 10;

export function getTransactionIdentity(transaction: ISwapProMarketTransaction) {
  return (
    transaction.hash ||
    `${transaction.timestamp}:${transaction.type}:${transaction.from.amount}:${transaction.to.amount}`
  );
}

export function mergeSwapProTransactions(
  ...transactionLists: ISwapProMarketTransaction[][]
): ISwapProMarketTransaction[] {
  const uniqueTransactions = uniqBy(
    transactionLists.flat(),
    getTransactionIdentity,
  );
  return orderBy(
    uniqueTransactions,
    [(transaction) => transaction.timestampMs ?? transaction.timestamp * 1000],
    ['desc'],
  ).slice(0, SWAP_PRO_TRANSACTION_LIMIT);
}

export function buildSwapProMarketData({
  source,
  transactions,
  marketSnapshotPrice,
  hasLoadedSource,
}: {
  source: ISwapProMarketDataSource | undefined;
  transactions: ISwapProMarketTransaction[];
  marketSnapshotPrice?: string;
  hasLoadedSource: boolean;
}): ISwapProMarketData {
  const latestTransaction = transactions[0];
  const latestTradePrice = latestTransaction
    ? getSwapProTransactionTokenPrice(latestTransaction)
    : '';
  return {
    source,
    price:
      latestTradePrice ||
      (source === 'market' ? (marketSnapshotPrice ?? '') : ''),
    transactions,
    isSourceSupported: Boolean(source),
    hasLoadedSource,
  };
}
