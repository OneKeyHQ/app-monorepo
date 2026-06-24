import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function normalizeSwapTokenListCurrency({
  tokens,
  currency,
}: {
  tokens: ISwapToken[];
  currency: string;
}) {
  return tokens.map((token) => {
    if (!token.price && !token.fiatValue) {
      return token;
    }

    return {
      ...token,
      currency,
    };
  });
}
