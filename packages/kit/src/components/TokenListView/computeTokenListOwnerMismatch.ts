import { getTokenListOwnerCacheAccountId } from './utils';

export interface IComputeTokenListOwnerMismatchParams {
  // The SCOPED current owner identity (live account-selector slot).
  accountId: string | undefined;
  networkId: string | undefined;
  indexedAccountId: string | undefined;
  // Merge-derive mode (BTC/LTC etc.): the per-owner key is keyed by
  // `indexedAccountId`, not the concrete derive `accountId`.
  mergeDeriveAddressData?: boolean;
  // The SETTLED owner key stamped on the last applied STRUCTURE frame
  // (`listStructureAtom().ownerKey`). Empty on non-home stores (no producer).
  settledOwnerKey: string | undefined;
}

/**
 * True when the SETTLED structure owner (lagging, stamped by the cells producer)
 * differs from the SCOPED current owner — i.e. an account/network switch is in
 * flight and the applied rows still belong to the previous owner, so the list
 * must skeleton rather than flash stale balances.
 *
 * CRITICAL — normalize BEFORE comparing. The producer stamps
 * `listStructureAtom().ownerKey` as `${ownerAccountId}__${networkId}` where
 * `ownerAccountId` is the merge-derive `indexedAccountId` (see
 * `useHomeTokenListOwnerKey` / `getTokenListOwnerCacheAccountId`). Comparing the
 * RAW scoped `accountId` here would diverge from that stamp for merge-derive
 * owners (BTC/LTC): the raw derive path (`hd-1--m/86'/0'/0'`) never equals the
 * stamped `indexedAccountId` (`hd-1--0`), so the mismatch would latch TRUE
 * forever and the list would skeleton permanently. Single-derive (EVM) owners
 * collapse to the same string, which is why the bug only ever surfaced on
 * merge-derive accounts. Build the expected key with the SAME normalization the
 * producer used and compare the full strings.
 */
export function computeTokenListOwnerMismatch(
  params: IComputeTokenListOwnerMismatchParams,
): boolean {
  const {
    accountId,
    networkId,
    indexedAccountId,
    mergeDeriveAddressData,
    settledOwnerKey,
  } = params;

  // No settled owner yet (non-home store, or first frame not applied) — defer to
  // the other skeleton gates, never claim a mismatch.
  if (!settledOwnerKey) {
    return false;
  }

  const ownerAccountId = getTokenListOwnerCacheAccountId({
    accountId,
    indexedAccountId,
    mergeDeriveAddressData,
  });

  // Current owner not resolvable yet — don't claim a mismatch.
  if (!ownerAccountId || !networkId) {
    return false;
  }

  const expectedOwnerKey = `${ownerAccountId}__${networkId}`;
  return expectedOwnerKey !== settledOwnerKey;
}
