import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function buildStockPositionTokens({
  marketItems,
  tokens,
}: {
  marketItems: (IMarketTokenListItem | null | undefined)[];
  tokens: ISwapToken[];
}): ISwapToken[] | undefined {
  if (
    marketItems.length !== tokens.length ||
    tokens.some((_, index) => !marketItems[index])
  ) {
    return undefined;
  }

  return tokens.flatMap((token, index) => {
    const stock = marketItems[index]?.stock;
    return stock ? [{ ...token, isStock: true, stock }] : [];
  });
}
