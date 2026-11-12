import { accessListify } from '@ethersproject/transactions';

import type { AccessList } from '@ethersproject/transactions';

/**
 * Returns the access list a transaction should carry, or `undefined` when
 * there is nothing usable to carry. Entry order and duplicates are kept,
 * since both end up in the signed bytes.
 *
 * An empty list is the same transaction as no list, and a list that cannot
 * be encoded (not an array, bad address, storage key that is not 32 bytes)
 * is treated as absent rather than failing the send: an access list only
 * changes gas accounting, never what the transaction executes.
 */
export function normalizeEvmAccessList(
  accessList: unknown,
): AccessList | undefined {
  if (!Array.isArray(accessList) || accessList.length === 0) {
    return undefined;
  }
  try {
    return accessListify(accessList);
  } catch {
    return undefined;
  }
}
