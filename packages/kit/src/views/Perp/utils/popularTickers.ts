const POPULAR_TICKER_COUNT = 10;

export interface IPopularTickerItem {
  mode: 'perp' | 'spot';
  coinName: string;
  displayName: string;
  imageTokenName: string;
  assetId: number;
  dexIndex: number;
  hotScore: number;
}

export function pickPopularPerpTickers({
  items,
  hotTabTokens,
}: {
  items: IPopularTickerItem[];
  hotTabTokens?: string[];
}) {
  if (hotTabTokens?.length) {
    const tokenRank = new Map<string, number>();
    hotTabTokens.forEach((token, index) => {
      const tokenName = token.trim();
      if (tokenName && !tokenRank.has(tokenName)) {
        tokenRank.set(tokenName, index);
      }
    });

    const hotTabItems = items
      .filter((item) => tokenRank.has(item.coinName))
      .toSorted(
        (a, b) =>
          (tokenRank.get(a.coinName) ?? Number.MAX_SAFE_INTEGER) -
            (tokenRank.get(b.coinName) ?? Number.MAX_SAFE_INTEGER) ||
          b.hotScore - a.hotScore,
      );
    if (hotTabItems.length) {
      return hotTabItems.slice(0, POPULAR_TICKER_COUNT);
    }
  }

  return items
    .filter((item) => item.hotScore > 0)
    .toSorted((a, b) => b.hotScore - a.hotScore)
    .slice(0, POPULAR_TICKER_COUNT);
}

export { POPULAR_TICKER_COUNT };
