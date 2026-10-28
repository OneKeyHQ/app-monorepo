/** How many networks the desktop network pill shows as icons, as Market's */
export const NETWORK_PILL_QUICK_COUNT = 4;

/**
 * The networks the pill shows as icons: the first few in the list's order
 * (most items first), then every picked network beyond them in that same
 * order, so a pick made from the full list stays in sight
 */
export function getQuickNetworkIds({
  orderedIds,
  selectedIds,
  count = NETWORK_PILL_QUICK_COUNT,
}: {
  orderedIds: string[];
  selectedIds: string[];
  count?: number;
}): string[] {
  const quick = orderedIds.slice(0, count);
  const picked = new Set(selectedIds);
  const beyond = orderedIds
    .slice(count)
    .filter((networkId) => picked.has(networkId));
  return [...quick, ...beyond];
}
