import { orderBy, uniqBy } from 'lodash';

import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { getSwapProTransactionTokenPrice } from './swapProTransactionSource';

import type { ISwapProMarketDataSource } from './swapProTransactionSource';

export type ISwapProMarketData = {
  source: ISwapProMarketDataSource | undefined;
  price: string;
  transactions: IMarketTokenTransaction[];
  isSourceSupported: boolean;
  hasLoadedSource: boolean;
};

const SWAP_PRO_TRANSACTION_LIMIT = 10;

function getTransactionIdentity(transaction: IMarketTokenTransaction) {
  return (
    transaction.hash ||
    `${transaction.timestamp}:${transaction.type}:${transaction.from.amount}:${transaction.to.amount}`
  );
}

export function mergeSwapProTransactions(
  ...transactionLists: IMarketTokenTransaction[][]
): IMarketTokenTransaction[] {
  const uniqueTransactions = uniqBy(
    transactionLists.flat(),
    getTransactionIdentity,
  );
  return orderBy(uniqueTransactions, ['timestamp'], ['desc']).slice(
    0,
    SWAP_PRO_TRANSACTION_LIMIT,
  );
}

export function buildSwapProMarketData({
  source,
  transactions,
  marketSnapshotPrice,
  hasLoadedSource,
}: {
  source: ISwapProMarketDataSource | undefined;
  transactions: IMarketTokenTransaction[];
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
