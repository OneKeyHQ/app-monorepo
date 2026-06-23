import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

type IStockPayTokenLike = Partial<ISwapToken> & {
  balance?: string;
};

export function shouldRefreshStockPayTokensForHistoryEvent({
  fromToken,
  rawPayTokens,
  toToken,
}: {
  fromToken?: ISwapToken;
  rawPayTokens: IStockPayTokenLike[];
  toToken?: ISwapToken;
}) {
  if (!fromToken && !toToken) {
    return false;
  }
  return rawPayTokens.some(
    (token) =>
      equalTokenNoCaseSensitive({ token1: fromToken, token2: token }) ||
      equalTokenNoCaseSensitive({ token1: toToken, token2: token }),
  );
}

export function shouldSyncStockPayTokenDetail({
  currentToken,
  nextToken,
}: {
  currentToken?: IStockPayTokenLike;
  nextToken?: IStockPayTokenLike;
}) {
  if (
    !currentToken ||
    !nextToken ||
    !equalTokenNoCaseSensitive({ token1: currentToken, token2: nextToken })
  ) {
    return false;
  }

  return (
    currentToken.balanceParsed !== nextToken.balanceParsed ||
    currentToken.balance !== nextToken.balance ||
    currentToken.currency !== nextToken.currency ||
    currentToken.fiatValue !== nextToken.fiatValue ||
    currentToken.price !== nextToken.price
  );
}
