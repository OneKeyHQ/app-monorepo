import BigNumber from 'bignumber.js';

import type { IKaspaBlockTransaction } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IKaspaRefTransaction } from './Vault';

// Reads a uint64 refTx field. nullMeansZero=false for amounts (empty ≠ 0), true
// for sequence/lockTime/gas — api.kaspa.org does send those as 0, so it is only
// a guard. Past 2^53 the JSON parse already rounded it, so bail, not sign wrong.
export function readRefTxUint64({
  value,
  field,
  txId,
  networkId,
  nullMeansZero,
}: {
  value: number | string | null | undefined;
  field: string;
  txId: string;
  networkId: string | undefined;
  nullMeansZero: boolean;
}): string {
  if (value === null || value === undefined) {
    if (!nullMeansZero) {
      throw new OneKeyLocalError(`kaspa refTx: ${field} missing for ${txId}`);
    }
    defaultLogger.transaction.send.refTxFieldDefaulted({
      network: networkId,
      txId,
      field,
    });
    return '0';
  }
  const parsed = new BigNumber(String(value));
  if (!parsed.isInteger() || parsed.gt(Number.MAX_SAFE_INTEGER)) {
    throw new OneKeyLocalError(
      `kaspa refTx: ${field} ${String(value)} exceeds safe integer range`,
    );
  }
  return parsed.toFixed();
}

// Maps a block-endpoint tx to the refTx shape the device recomputes the txid from.
export function buildKaspaRefTx({
  tx,
  networkId,
}: {
  tx: IKaspaBlockTransaction;
  networkId: string | undefined;
}): IKaspaRefTransaction {
  const txId = tx.verboseData?.transactionId;
  if (!txId) {
    throw new OneKeyLocalError('kaspa refTx: block transaction has no txId');
  }
  // A coinbase prev tx has no inputs; missing outputs would produce a wrong txid.
  if (!Array.isArray(tx.outputs) || tx.outputs.length === 0) {
    throw new OneKeyLocalError(`kaspa refTx: no outputs for ${txId}`);
  }
  const uint64 = (
    value: number | string | null | undefined,
    field: string,
    nullMeansZero: boolean,
  ) => readRefTxUint64({ value, field, txId, networkId, nullMeansZero });

  return {
    txId,
    version: tx.version,
    inputs: (tx.inputs ?? []).map((input) => ({
      prevTxId: input.previousOutpoint.transactionId,
      outputIndex: Number(input.previousOutpoint.index ?? 0),
      sequenceNumber: uint64(input.sequence, 'input.sequence', true),
    })),
    outputs: tx.outputs.map((output) => ({
      satoshis: uint64(output.amount, 'output.amount', false),
      script: output.scriptPublicKey.scriptPublicKey,
      scriptVersion: Number(
        uint64(
          output.scriptPublicKey.version,
          'output.scriptPublicKey.version',
          true,
        ),
      ),
    })),
    lockTime: uint64(tx.lockTime, 'lockTime', true),
    subNetworkID: tx.subnetworkId,
    gas: uint64(tx.gas, 'gas', true),
    payload: tx.payload ?? '',
  };
}
