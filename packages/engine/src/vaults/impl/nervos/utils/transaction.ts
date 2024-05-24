import { blockchain } from '@ckb-lumos/base';
import { BI } from '@ckb-lumos/bi';
import { common } from '@ckb-lumos/common-scripts';
import {
  createTransactionFromSkeleton,
  createTransactionSkeleton,
} from '@ckb-lumos/helpers';
import { ResultFormatter } from '@ckb-lumos/rpc';

import { addHexPrefix } from '@onekeyhq/engine/src/vaults/utils/hexUtils';

import type { Cell, OutPoint, Transaction } from '@ckb-lumos/base';
import type {
  LiveCellFetcher,
  TransactionSkeletonType,
} from '@ckb-lumos/helpers';
import type { RPC } from '@ckb-lumos/rpc';

export const DEFAULT_MIN_INPUT_CAPACITY = 61 * 100000000;

export async function convertTxToTxSkeleton({
  client,
  transaction,
}: {
  client: RPC;
  transaction: Transaction;
}) {
  const fetcher: LiveCellFetcher = async (
    outPoint: OutPoint,
  ): Promise<Cell> => {
    const content = await client.getLiveCell(outPoint, true);

    const rpcCell = content.cell;
    if (!rpcCell) {
      throw new Error('Cell not found');
    }

    return {
      outPoint,
      cellOutput: {
        capacity: rpcCell.output.capacity,
        lock: ResultFormatter.toScript({
          args: rpcCell.output.lock.args,
          code_hash: rpcCell.output.lock.codeHash,
          hash_type: rpcCell.output.lock.hashType,
        }),
        type: rpcCell.output.type
          ? ResultFormatter.toScript({
              args: rpcCell.output.type.args,
              code_hash: rpcCell.output.type.codeHash,
              hash_type: rpcCell.output.type.hashType,
            })
          : undefined,
      },
      data: rpcCell.data.content,
    };
  };

  return createTransactionSkeleton(transaction, fetcher);
}

export function serializeTransactionMessage(
  txSkeleton: TransactionSkeletonType,
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const txSkeletonWithMessage = common.prepareSigningEntries(txSkeleton);

  const signingEntries = txSkeletonWithMessage.get('signingEntries');
  if (signingEntries?.size === 0) {
    throw new Error('No signingEntries');
  }
  const message = signingEntries.get(0)?.message;
  return {
    txSkeleton: txSkeletonWithMessage,
    message,
  };
}

export function convertTxSkeletonToTransaction(
  txSkeleton: TransactionSkeletonType,
) {
  const transaction = createTransactionFromSkeleton(txSkeleton);
  return transaction;
}

export function convertRawTxToApiTransaction(rawTx: string): Transaction {
  const transaction = blockchain.Transaction.unpack(addHexPrefix(rawTx));

  return {
    version: BI.from(transaction.version).toHexString(),
    cellDeps: transaction.cellDeps.map((cellDep) => ({
      depType: cellDep.depType,
      outPoint: {
        txHash: cellDep.outPoint.txHash,
        index: BI.from(cellDep.outPoint.index).toHexString(),
      },
    })),
    headerDeps: transaction.headerDeps,
    inputs: transaction.inputs.map((input) => ({
      previousOutput: {
        txHash: input.previousOutput.txHash,
        index: BI.from(input.previousOutput.index).toHexString(),
      },
      since: BI.from(input.since).toHexString(),
    })),
    outputs: transaction.outputs.map((output) => ({
      capacity: BI.from(output.capacity).toHexString(),
      lock: output.lock,
      type: output.type,
    })),
    outputsData: transaction.outputsData,
    witnesses: transaction.witnesses,
  };
}

export function getTransactionSizeByTxSkeleton(
  txSkeleton: TransactionSkeletonType,
): number {
  const { txSkeleton: txSkeletonMessage } =
    serializeTransactionMessage(txSkeleton);
  const tx = convertTxSkeletonToTransaction(txSkeletonMessage);
  const serializedTx = blockchain.Transaction.pack(tx);
  // 4 is serialized offset bytesize
  const size = serializedTx.byteLength + 4;
  return size;
}
