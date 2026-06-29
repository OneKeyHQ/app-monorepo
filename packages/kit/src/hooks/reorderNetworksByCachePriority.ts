/**
 * L3 — float cache-non-empty (likely-funded) networks to the front of the
 * all-network fan-out so the first bounded-concurrency wave fetches the user's
 * real holdings first. Pure + stable: relative order within the priority group
 * and within the rest is preserved; the input array is never mutated; and an
 * empty priority set returns the original order (a no-op).
 *
 * On its own this does not change time-to-full-paint (the consumer still ingests
 * once the whole fan-out settles); its value is unlocked by L2 (progressive
 * paint), where the first wave's contents become the first visible rows.
 */
export function reorderNetworksByCachePriority<
  T extends { networkId?: string },
>(items: T[], priorityNetworkIds: Set<string>): T[] {
  if (!priorityNetworkIds.size) {
    return items;
  }
  const priority: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (item.networkId && priorityNetworkIds.has(item.networkId)) {
      priority.push(item);
    } else {
      rest.push(item);
    }
  }
  return [...priority, ...rest];
}
