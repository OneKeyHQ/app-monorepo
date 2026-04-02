import { isEqual } from 'lodash';

import type { IEncodedTx } from '@onekeyhq/core/src/types';

type IEncodedTxWithRawSignTx = IEncodedTx & {
  rawSignTx?: unknown;
};

function getEncodedTxRawSignTx(encodedTx?: IEncodedTx) {
  const rawSignTx = (encodedTx as IEncodedTxWithRawSignTx | undefined)
    ?.rawSignTx;

  return typeof rawSignTx === 'string' && rawSignTx.length > 0
    ? rawSignTx
    : undefined;
}

export function isEncodedTxMatch(left?: IEncodedTx, right?: IEncodedTx) {
  if (!left || !right) {
    return false;
  }

  const leftRawSignTx = getEncodedTxRawSignTx(left);
  const rightRawSignTx = getEncodedTxRawSignTx(right);

  return Boolean(
    isEqual(left, right) ||
    (leftRawSignTx && rightRawSignTx && leftRawSignTx === rightRawSignTx),
  );
}
