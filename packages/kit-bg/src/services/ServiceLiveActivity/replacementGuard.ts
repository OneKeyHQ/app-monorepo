const replacedDeposits = new Map<string, number>();
const blockedOrders = new Map<string, number>();

function pruneExpired() {
  const now = Date.now();
  for (const [key, expiresAt] of replacedDeposits) {
    if (expiresAt <= now) replacedDeposits.delete(key);
  }
  for (const [key, expiresAt] of blockedOrders) {
    if (expiresAt <= now) blockedOrders.delete(key);
  }
}

export function markReplacedDeposit(txId: string, expiresAt: number) {
  pruneExpired();
  replacedDeposits.set(txId, expiresAt);
}

export function markBlockedOrder(orderKey: string, expiresAt: number) {
  pruneExpired();
  blockedOrders.set(
    orderKey,
    Math.max(blockedOrders.get(orderKey) ?? 0, expiresAt),
  );
}

export function isReplacedDeposit(txId: string | undefined) {
  return (replacedDeposits.get(txId ?? '') ?? 0) > Date.now();
}

export function isBlockedOrder(orderKey: string) {
  return (blockedOrders.get(orderKey) ?? 0) > Date.now();
}

export function clearReplacementGuards() {
  replacedDeposits.clear();
  blockedOrders.clear();
}
