import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

type IStockPayTokenLike = Partial<ISwapToken> & {
  balance?: string;
};

const STOCK_PAY_TOKEN_DETAILS_DEDUPING_INTERVAL_MS = 1000;
const STOCK_PAY_TOKEN_DETAILS_REQUEST_CACHE_MAX_SIZE = 20;

type IStockPayTokenDetailsRequestCacheEntry = {
  expiresAt: number;
  request: Promise<unknown>;
};

const stockPayTokenDetailsRequestMap = new Map<
  string,
  IStockPayTokenDetailsRequestCacheEntry
>();

export async function runStockPayTokenDetailsRequest<T>({
  dedupingInterval = STOCK_PAY_TOKEN_DETAILS_DEDUPING_INTERVAL_MS,
  request,
  scope,
}: {
  dedupingInterval?: number;
  request: () => Promise<T>;
  scope: string;
}): Promise<T> {
  const now = Date.now();
  stockPayTokenDetailsRequestMap.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      stockPayTokenDetailsRequestMap.delete(key);
    }
  });
  const cachedRequest = stockPayTokenDetailsRequestMap.get(scope);
  if (cachedRequest) {
    return cachedRequest.request as Promise<T>;
  }
  if (
    stockPayTokenDetailsRequestMap.size >=
    STOCK_PAY_TOKEN_DETAILS_REQUEST_CACHE_MAX_SIZE
  ) {
    const oldestScope = stockPayTokenDetailsRequestMap.keys().next().value;
    if (oldestScope) {
      stockPayTokenDetailsRequestMap.delete(oldestScope);
    }
  }
  const nextRequest = request();
  stockPayTokenDetailsRequestMap.set(scope, {
    expiresAt: now + dedupingInterval,
    request: nextRequest,
  });
  try {
    return await nextRequest;
  } catch (error) {
    if (stockPayTokenDetailsRequestMap.get(scope)?.request === nextRequest) {
      stockPayTokenDetailsRequestMap.delete(scope);
    }
    throw error;
  }
}

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
