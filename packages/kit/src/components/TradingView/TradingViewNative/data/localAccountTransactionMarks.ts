import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { isPrivateSendSwapHistoryItem } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import type { IMarketAccountTokenTransaction } from '@onekeyhq/shared/types/marketV2';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import { buildTransactionMarks } from '../../utils/accountTransactionMarks';

import type { IAccountTransactionMark } from '../../utils/accountTransactionMarks';

export function normalizeAccountTransactionAddress(address: string) {
  return address.startsWith('0x') ? address.toLowerCase() : address;
}

export function buildLocalAccountTransactionMarks({
  histories,
  accountAddress,
  networkId,
  tokenAddress,
  from,
  to,
}: {
  histories: ISwapTxHistory[];
  accountAddress: string;
  networkId: string;
  tokenAddress: string;
  from: number;
  to: number;
}) {
  const transactions: IMarketAccountTokenTransaction[] = [];
  histories.forEach((history) => {
    const { baseInfo, txInfo } = history;
    const transactionHash = txInfo.txId;
    // Only confirmed on-chain swaps have enough local evidence for a fill mark.
    // Order submissions, partial fills and cross-chain settlements need indexed fills.
    if (
      history.status !== ESwapTxHistoryStatus.SUCCESS ||
      isPrivateSendSwapHistoryItem(history) ||
      (history.protocol &&
        history.protocol !== EProtocolOfExchange.SWAP &&
        history.protocol !== EProtocolOfExchange.STOCK) ||
      !transactionHash ||
      txInfo.useOrderId ||
      baseInfo.fromToken.networkId !== baseInfo.toToken.networkId
    ) {
      return;
    }
    // Submission time is stable; history.updated also changes during later repairs.
    const timestamp = Math.floor(history.date.created / 1000);
    if (timestamp < from || timestamp > to) {
      return;
    }
    (['buy', 'sell'] as const).forEach((side) => {
      const token = side === 'buy' ? baseInfo.toToken : baseInfo.fromToken;
      const address = side === 'buy' ? txInfo.receiver : txInfo.sender;
      const amount = side === 'buy' ? baseInfo.toAmount : baseInfo.fromAmount;
      if (
        token.networkId !== networkId ||
        normalizeAccountTransactionAddress(token.contractAddress) !==
          normalizeAccountTransactionAddress(tokenAddress) ||
        normalizeAccountTransactionAddress(address) !==
          normalizeAccountTransactionAddress(accountAddress)
      ) {
        return;
      }
      transactions.push({
        hash: transactionHash,
        type: side,
        timestamp,
        amount,
        from: {
          amount: baseInfo.fromAmount,
          address: txInfo.sender,
          symbol: baseInfo.fromToken.symbol,
        },
        to: { amount, address, symbol: token.symbol },
      });
    });
  });
  return buildTransactionMarks({ transactions });
}

export async function fetchLocalAccountTransactionMarks(
  params: Omit<
    Parameters<typeof buildLocalAccountTransactionMarks>[0],
    'histories'
  >,
) {
  const histories =
    await backgroundApiProxy.serviceSwap.fetchSwapHistoryListFromSimple();
  return buildLocalAccountTransactionMarks({ ...params, histories });
}

export function mergeAccountTransactionMarks({
  localMarks,
  serverMarks,
  from,
  to,
}: {
  localMarks: readonly IAccountTransactionMark[];
  serverMarks: readonly IAccountTransactionMark[];
  from: number;
  to: number;
}): IAccountTransactionMark[] {
  const marks = new Map<string, IAccountTransactionMark>();
  // Indexed fills replace the provisional local time/amount for the same transaction.
  for (const mark of [...localMarks, ...serverMarks]) {
    marks.set(
      `${normalizeAccountTransactionAddress(mark.transactionHash)}:${mark.label}`,
      mark,
    );
  }
  return [...marks.values()]
    .filter((mark) => mark.time >= from && mark.time <= to)
    .toSorted((a, b) => a.time - b.time)
    .slice(-60);
}
