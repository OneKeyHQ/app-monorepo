import {
  Deserializer,
  MultiAgentTransaction,
  SimpleTransaction,
} from '@aptos-labs/ts-sdk';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import type { AnyRawTransaction } from '@aptos-labs/ts-sdk';

export function deserializeTransaction(
  txn: string | Uint8Array,
): AnyRawTransaction {
  const serializedData =
    typeof txn === 'string'
      ? Buffer.from(hexUtils.stripHexPrefix(txn), 'hex')
      : txn;

  try {
    const deserializer = new Deserializer(serializedData);
    const transaction = SimpleTransaction.deserialize(deserializer);

    if (deserializer.remaining() === 0) {
      return transaction;
    }
  } catch (error) {
    // ignore
  }

  try {
    const deserializer = new Deserializer(serializedData);
    const transaction = MultiAgentTransaction.deserialize(deserializer);

    if (deserializer.remaining() === 0) {
      return transaction;
    }
  } catch (error) {
    throw new OneKeyLocalError(`Failed to deserialize transaction`);
  }

  throw new OneKeyLocalError(
    'Transaction data does not match either SimpleTransaction or MultiAgentTransaction format',
  );
}
