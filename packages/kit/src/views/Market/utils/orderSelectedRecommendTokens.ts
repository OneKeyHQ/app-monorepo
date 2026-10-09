/**
 * Selection stores tokens in toggle order. Unchecking and checking again
 * appends the token, so the saved watchlist must be reordered to the
 * recommend grid before a preserve-order add.
 */
export function orderSelectedRecommendTokens<T>(
  recommendedTokens: readonly T[],
  selectedTokens: readonly T[],
  getKey: (token: T) => string,
): T[] {
  const selectedKeys = new Set(selectedTokens.map(getKey));
  return recommendedTokens.filter((token) => selectedKeys.has(getKey(token)));
}
