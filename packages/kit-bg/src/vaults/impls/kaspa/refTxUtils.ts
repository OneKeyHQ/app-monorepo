import BigNumber from 'bignumber.js';

import type { IKaspaBlockTransaction } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IKaspaRefTransaction } from './Vault';

const MAX_UINT64 = '18446744073709551615';

// Reads a uint64 refTx field. nullMeansZero=false for amounts (empty ≠ 0), true
// for sequence/lockTime/gas — api.kaspa.org does send those as 0, so it is only
// a guard. A number has already been through JSON.parse and cannot be trusted past
// 2^53; a string reached us intact, so it gets the real uint64 range.
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
  const limit =
    typeof value === 'string' ? MAX_UINT64 : String(Number.MAX_SAFE_INTEGER);
  if (!parsed.isInteger() || parsed.isNegative() || parsed.gt(limit)) {
    throw new OneKeyLocalError(
      `kaspa refTx: ${field} ${String(value)} is not a uint64 we can trust`,
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
  // The refTx stream carries no sigOpCount, so the device recomputes the id with the
  // default. KeyringHardware reads the real count for the tx being signed, so a prev tx
  // that spent a P2SH or multisig input would not reproduce — bail like the v1 gate does.
  if ((tx.inputs ?? []).some((input) => Number(input.sigOpCount ?? 1) !== 1)) {
    throw new OneKeyLocalError(
      `kaspa refTx: unsupported sigOpCount in ${txId}`,
    );
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
