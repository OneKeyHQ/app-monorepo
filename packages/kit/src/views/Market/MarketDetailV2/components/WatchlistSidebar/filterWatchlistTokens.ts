import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

// Matches only within the hydrated favorites, so a query never reaches the
// remote search. Listings and perps carry no address; their names, coins and
// stock IDs cover them instead.
export function filterWatchlistTokens(
  tokens: IMarketToken[],
  query: string,
): IMarketToken[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) {
    return tokens;
  }
  return tokens.filter((token) =>
    [
      token.symbol,
      token.name,
      token.address,
      token.perpsCoin,
      token.perpsSubtitle,
      token.stockId,
      token.stock?.title,
      token.stock?.subtitle,
    ].some((field) => field?.toLowerCase().includes(keyword)),
  );
}
