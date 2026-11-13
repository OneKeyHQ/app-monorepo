import { accessListify } from '@ethersproject/transactions';
import BigNumber from 'bignumber.js';

import type { AccessList } from '@ethersproject/transactions';

// ZK Stack nodes reject every transaction that carries access-list entries:
// an EIP-2930 envelope outright, and an EIP-1559 one whose list is not empty.
const ACCESS_LIST_UNSUPPORTED_CHAIN_IDS = new Set([
  '324', // zkSync Era
  '300', // zkSync Sepolia
  '810180', // zkLink Nova
]);

export function isEvmAccessListSupported(
  chainId: string | number | undefined,
): boolean {
  if (chainId === undefined) {
    return true;
  }
  return !ACCESS_LIST_UNSUPPORTED_CHAIN_IDS.has(
    new BigNumber(chainId).toFixed(),
  );
}

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

/**
 * The normalized access list for a transaction on `chainId`, or `undefined`
 * on a chain whose nodes reject access lists. Signing and fee estimation
 * both go through this, so they describe the same transaction.
 */
export function getEvmAccessListForChain({
  accessList,
  chainId,
}: {
  accessList: unknown;
  chainId: string | number | undefined;
}): AccessList | undefined {
  if (!isEvmAccessListSupported(chainId)) {
    return undefined;
  }
  return normalizeEvmAccessList(accessList);
}
