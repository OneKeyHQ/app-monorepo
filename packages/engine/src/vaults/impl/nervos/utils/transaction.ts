import { blockchain } from '@ckb-lumos/base';
import { BI } from '@ckb-lumos/bi';
import { bytes } from '@ckb-lumos/codec';
import { common } from '@ckb-lumos/common-scripts';
import {
  TransactionSkeleton,
  createTransactionFromSkeleton,
  parseAddress,
} from '@ckb-lumos/helpers';
import BigNumber from 'bignumber.js';

import {
  ChangeLessThanMinInputCapacityError,
  InsufficientBalance,
} from '@onekeyhq/engine/src/errors';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type {
  IFeeInfoUnit,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';
import { addHexPrefix } from '@onekeyhq/engine/src/vaults/utils/hexUtils';

import { selectCellsByAddress } from './balance';

import type { IEncodedTxNervos } from '../types/IEncodedTx';
import type { Cell, Transaction, WitnessArgs } from '@ckb-lumos/base';
import type { Config } from '@ckb-lumos/config-manager';
import type { TransactionSkeletonType } from '@ckb-lumos/helpers';

export const DEFAULT_FEE = 100000;
export const DEFAULT_MIN_INPUT_CAPACITY = 61 * 100000000;

export function prepareAndBuildTx({
  confirmCells,
  from,
  network,
  transferInfo,
  config,
  specifiedFeeRate,
}: {
  confirmCells: Cell[];
  from: string;
  network: Network;
  transferInfo: ITransferInfo;
  config: Config;
  specifiedFeeRate?: IFeeInfoUnit;
}): IEncodedTxNervos {
  const { to, amount } = transferInfo;
  const amountValue = new BigNumber(amount)
    .shiftedBy(network.decimals)
    .toFixed();

  let fee = new BigNumber(DEFAULT_FEE);
  if (specifiedFeeRate?.limit && specifiedFeeRate?.price) {
    const price = new BigNumber(specifiedFeeRate.price).shiftedBy(
      network.decimals,
    );
    fee = new BigNumber(specifiedFeeRate.limit).multipliedBy(price);
  }

  const allAmount = confirmCells.reduce(
    (sum, cell) => sum.plus(new BigNumber(cell.cellOutput.capacity, 16)),
    new BigNumber(0),
  );
  const hasMaxSend = new BigNumber(amountValue).isGreaterThanOrEqualTo(
    allAmount,
  );

  let expendCapacity: BigNumber;
  let neededCapacity: BigNumber;

  if (hasMaxSend) {
    expendCapacity = allAmount;
    neededCapacity = new BigNumber(amountValue);
  } else {
    expendCapacity = new BigNumber(amountValue).plus(fee);
    neededCapacity = expendCapacity.plus(DEFAULT_MIN_INPUT_CAPACITY);
  }

  const { collected, collectedSum } = selectCellsByAddress(
    confirmCells,
    neededCapacity,
  );

  const change = collectedSum.minus(expendCapacity);
  if (!hasMaxSend && change.minus(DEFAULT_MIN_INPUT_CAPACITY).isLessThan(0)) {
    throw new ChangeLessThanMinInputCapacityError('61');
  }

  if (collectedSum.isLessThan(amountValue))
    throw new InsufficientBalance(
      `Insufficient balance - need: ${amountValue} CKB, available: ${collectedSum.toFixed()} CKB`,
    );

  const secp256k1Dep = config.SCRIPTS.SECP256K1_BLAKE160;
  if (!secp256k1Dep) {
    throw new Error('Not implemented transafe');
  }

  const sendAmount = hasMaxSend
    ? collectedSum.minus(fee).toFixed()
    : amountValue;

  const encodedTxNervos: IEncodedTxNervos = {
    transferInfo,
    hasMaxSend,
    cellDeps: [
      {
        outPoint: {
          txHash: secp256k1Dep.TX_HASH,
          index: secp256k1Dep.INDEX,
        },
        depType: secp256k1Dep.DEP_TYPE,
      },
    ],
    inputs: collected,
    outputs: [
      {
        address: to,
        value: sendAmount,
      },
    ],
    feeInfo: {
      limit: specifiedFeeRate?.limit,
      price: specifiedFeeRate?.price,
    },
  };

  if (change.isGreaterThan(0)) {
    encodedTxNervos.change = {
      address: from,
      value: change.toFixed(),
    };
  }

  return encodedTxNervos;
}

/**
 * only from onekey transfer
 */
export function convertEncodeTxNervosToSkeleton({
  encodedTxNervos,
  config,
}: {
  encodedTxNervos: IEncodedTxNervos;
  config: Config;
}) {
  let txSkeleton = TransactionSkeleton({});

  txSkeleton = txSkeleton.update('inputs', (inputs) =>
    inputs.push(...encodedTxNervos.inputs),
  );
  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    const outputsIncludeChange = encodedTxNervos.change
      ? [...encodedTxNervos.outputs, encodedTxNervos.change]
      : encodedTxNervos.outputs;

    const newOutputs = outputsIncludeChange.map((output) => {
      const { address, value, data } = output;
      const toScript = parseAddress(address, { config });
      return {
        cellOutput: {
          capacity: BI.from(value).toHexString(),
          lock: toScript,
        },
        data: data ?? '0x',
      };
    });

    return outputs.push(...newOutputs);
  });

  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) =>
    cellDeps.push(...encodedTxNervos.cellDeps),
  );

  return txSkeleton;
}

export function fillSkeletonWitnessesWithAccount({
  sendAccount,
  txSkeleton: tx,
  config,
}: {
  sendAccount: string;
  txSkeleton: TransactionSkeletonType;
  config: Config;
}): TransactionSkeletonType {
  let txSkeleton = tx;
  const firstIndex = txSkeleton
    .get('inputs')
    .findIndex((input) =>
      bytes.equal(
        blockchain.Script.pack(input.cellOutput.lock),
        blockchain.Script.pack(parseAddress(sendAccount, { config })),
      ),
    );

  if (firstIndex !== -1) {
    while (firstIndex >= txSkeleton.get('witnesses').size) {
      txSkeleton = txSkeleton.update('witnesses', (witnesses) =>
        witnesses.push('0x'),
      );
    }
    let witness: string = txSkeleton.get('witnesses').get(firstIndex)!;
    const newWitnessArgs: WitnessArgs = {
      /* 65-byte zeros in hex */
      lock: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    };
    if (witness !== '0x') {
      const witnessArgs = blockchain.WitnessArgs.unpack(bytes.bytify(witness));
      const { lock } = witnessArgs;
      if (
        !!lock &&
        !!newWitnessArgs.lock &&
        !bytes.equal(lock, newWitnessArgs.lock)
      ) {
        throw new Error(
          'Lock field in first witness is set aside for signature!',
        );
      }
      const { inputType } = witnessArgs;
      if (inputType) {
        newWitnessArgs.inputType = inputType;
      }
      const { outputType } = witnessArgs;
      if (outputType) {
        newWitnessArgs.outputType = outputType;
      }
    }
    witness = bytes.hexify(blockchain.WitnessArgs.pack(newWitnessArgs));
    txSkeleton = txSkeleton.update('witnesses', (witnesses) =>
      witnesses.set(firstIndex, witness),
    );
  }

  return txSkeleton;
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

export function convertRawTxToTransaction(rawTx: string) {
  const transaction = blockchain.Transaction.unpack(addHexPrefix(rawTx));
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
