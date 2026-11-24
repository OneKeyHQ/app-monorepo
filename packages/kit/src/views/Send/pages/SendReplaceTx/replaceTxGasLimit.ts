import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';

/**
 * Gas limit for a replacement transaction.
 *
 * A replacement keeps the original limit, except when it carries an access
 * list: a transaction sent by an older app version was signed without the
 * list although history kept it, so its limit never paid for the list. The
 * fresh estimate then wins when it is higher.
 */
export function getReplaceTxGasLimit({
  replaceEncodedTx,
  originalGasLimit,
  estimatedGasLimit,
}: {
  replaceEncodedTx: Pick<IEncodedTxEvm, 'accessList'>;
  originalGasLimit: string | undefined;
  estimatedGasLimit: string | undefined;
}): string | undefined {
  if (
    !replaceEncodedTx.accessList?.length ||
    isNil(originalGasLimit) ||
    isNil(estimatedGasLimit)
  ) {
    return originalGasLimit;
  }
  const estimated = new BigNumber(estimatedGasLimit);
  return estimated.isGreaterThan(originalGasLimit)
    ? estimated.toFixed()
    : originalGasLimit;
}
