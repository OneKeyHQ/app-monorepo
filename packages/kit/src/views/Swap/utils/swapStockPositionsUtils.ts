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
    const marketItem = marketItems[index];
    const stock = marketItem?.stock;
    const resolvedStockId = stock?.stockId || marketItem?.stockId;
    return stock
      ? [
          {
            ...token,
            isStock: true,
            stock: {
              ...stock,
              // The batch endpoint keeps the stable market identity on the
              // list item, while the nested metadata may omit it.
              ...(resolvedStockId ? { stockId: resolvedStockId } : {}),
            },
          },
        ]
      : [];
  });
}
