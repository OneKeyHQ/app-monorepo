// Privacy accounts syncing at once, across every privacy chain.
export const PRIVACY_CHAIN_SYNC_SLOTS = 5;

// Accounts per network that may keep local data, paused ones included: a
// pause frees a sync slot but not storage.
export const PRIVACY_CHAIN_ACCOUNTS_PER_NETWORK = 5;

// An account already holding data, or an alias of one, takes no new place.
export function canAdmitNetworkAccount({
  holders,
  accountId,
  identity,
  max = PRIVACY_CHAIN_ACCOUNTS_PER_NETWORK,
}: {
  holders: { accountId: string; identity: string }[];
  accountId: string;
  identity?: string;
  max?: number;
}): boolean {
  if (
    holders.some(
      (holder) =>
        holder.accountId === accountId ||
        (identity !== undefined && holder.identity === identity),
    )
  ) {
    return true;
  }
  return new Set(holders.map((holder) => holder.identity)).size < max;
}

export type IPrivacyChainSyncSlot = {
  key: string;
  networkId: string;
  // Accounts sharing this viewing identity, and therefore this slot.
  accountIds: string[];
  refreshedAt?: number;
  enabledAt?: number;
  // A slot held by an in-flight deletion cannot be released.
  releasable: boolean;
};

// Least recently used first: older latest refresh, then older latest enable.
function compareSlotAge(
  a: IPrivacyChainSyncSlot,
  b: IPrivacyChainSyncSlot,
): number {
  return (
    (a.refreshedAt ?? 0) - (b.refreshedAt ?? 0) ||
    (a.enabledAt ?? 0) - (b.enabledAt ?? 0)
  );
}

// Slots to release so that at most `max` remain; `keepKey` is never chosen.
export function pickSyncSlotsToRelease({
  slots,
  keepKey,
  max = PRIVACY_CHAIN_SYNC_SLOTS,
}: {
  slots: IPrivacyChainSyncSlot[];
  keepKey?: string;
  max?: number;
}): IPrivacyChainSyncSlot[] {
  const excess = slots.length - max;
  if (excess <= 0) return [];
  return slots
    .filter((slot) => slot.releasable && slot.key !== keepKey)
    .toSorted(compareSlotAge)
    .slice(0, excess);
}
