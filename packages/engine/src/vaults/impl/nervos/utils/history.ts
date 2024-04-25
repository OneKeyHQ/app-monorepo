import { createTransactionSkeleton } from '@ckb-lumos/helpers';
import BigNumber from 'bignumber.js';

import type { Token } from '@onekeyhq/kit/src/store/typings';

import { scriptToAddress } from './address';
import { decodeBalanceWithCell } from './balance';

import type { PartialTokenInfo } from '../../../../types/provider';
import type {
  Cell,
  Header,
  OutPoint,
  Transaction,
  TransactionWithStatus,
} from '@ckb-lumos/base';
import type { TransactionCollector } from '@ckb-lumos/ckb-indexer';
import type { Config } from '@ckb-lumos/config-manager';
import type {
  LiveCellFetcher,
  TransactionSkeletonType,
} from '@ckb-lumos/helpers';
import type { RPC } from '@ckb-lumos/rpc';

export async function fetchTransactionHistory({
  transactionCollector,
  limit = 10,
}: {
  limit: number;
  transactionCollector: TransactionCollector;
}) {
  const maxCount = limit;
  const collector = transactionCollector.collect();

  let count = 0;
  const results: TransactionWithStatus<Transaction>[] = [];
  for await (const transaction of collector) {
    results.push(transaction as TransactionWithStatus<Transaction>);
    count += 1;
    if (count >= maxCount) {
      break;
    }
  }

  // filter repeat txid
  return results.filter(
    (tx, index, self) =>
      self.findIndex((t) => t.transaction.hash === tx.transaction.hash) ===
      index,
  );
}

export async function fullTransactionHistory({
  client,
  transferHistoryArray,
}: {
  client: RPC;
  transferHistoryArray: TransactionWithStatus<Transaction>[];
}) {
  const fetcher: LiveCellFetcher = async (outPoint: OutPoint) => {
    const transaction = await client.getTransaction(outPoint.txHash);
    const outputIndex = parseInt(outPoint.index, 16);
    const output = transaction.transaction.outputs[outputIndex];
    const outputData = transaction.transaction.outputsData[outputIndex];

    return {
      cellOutput: output,
      data: outputData,
      outPoint,
    };
  };

  const historySkeletons: {
    txSkeleton: TransactionSkeletonType;
    txWithStatus: TransactionWithStatus<Transaction>;
    txBlockHeader: Header;
  }[] = [];
  for (const history of transferHistoryArray) {
    if (history.txStatus.blockHash) {
      const skeleton = await createTransactionSkeleton(
        history.transaction,
        fetcher,
      );

      const blockHeader = await client.getHeader(
        history.txStatus.blockHash,
        '0x1',
      );
      historySkeletons.push({
        txSkeleton: skeleton,
        txWithStatus: history,
        txBlockHeader: blockHeader,
      });
    }
  }
  return historySkeletons;
}

export function convertHistoryUtxos(
  cell: Cell[],
  mineAddress: string,
  tokenInfo: Token,
  config: Config,
) {
  return cell?.map((c) => ({
    address: scriptToAddress(c.cellOutput.lock, { config }),
    balance: new BigNumber(c.cellOutput.capacity, 16)
      .shiftedBy(-tokenInfo.decimals)
      .toFixed(),
    balanceValue: new BigNumber(c.cellOutput.capacity, 16).toString(),
    symbol: tokenInfo.symbol,
    isMine: scriptToAddress(c.cellOutput.lock, { config }) === mineAddress,
  }));
}

export function convertTokenHistoryUtxos(
  cell: Cell[],
  mineAddress: string,
  tokenInfo: PartialTokenInfo,
  config: Config,
) {
  return cell?.map((c) => ({
    address: scriptToAddress(c.cellOutput.lock, { config }),
    balance: decodeBalanceWithCell(c, config)
      .shiftedBy(-tokenInfo.decimals)
      .toFixed(),
    balanceValue: decodeBalanceWithCell(c, config).toString(),
    symbol: tokenInfo.symbol,
    isMine: scriptToAddress(c.cellOutput.lock, { config }) === mineAddress,
  }));
}
