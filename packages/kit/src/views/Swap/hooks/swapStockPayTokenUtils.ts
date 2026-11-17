import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

type IStockPayTokenLike = Partial<ISwapToken> & {
  balance?: string;
};

const STOCK_PAY_TOKEN_DETAILS_DEDUPING_INTERVAL_MS = 1000;
const STOCK_PAY_TOKEN_DETAILS_REQUEST_CACHE_MAX_SIZE = 20;

export type IStockTokenDetailsRequestMode = 'dedupe' | 'revalidate';

type IStockTokenDetailsPendingRequest = {
  request: Promise<unknown>;
  queuedRevalidation?: Promise<unknown>;
};

type IStockTokenDetailsSettledResult = {
  expiresAt: number;
  result: unknown;
};

const stockTokenDetailsPendingRequestMap = new Map<
  string,
  IStockTokenDetailsPendingRequest
>();

const stockTokenDetailsSettledResultCache = new cacheUtils.LRUCache<
  string,
  IStockTokenDetailsSettledResult
>({
  max: STOCK_PAY_TOKEN_DETAILS_REQUEST_CACHE_MAX_SIZE,
});

function readStockTokenDetailsSettledResult<T>(scope: string) {
  const cachedResult = stockTokenDetailsSettledResultCache.get(scope);
  if (!cachedResult) {
    return undefined;
  }
  if (cachedResult.expiresAt <= Date.now()) {
    stockTokenDetailsSettledResultCache.delete(scope);
    return undefined;
  }
  return {
    result: cachedResult.result as T,
  };
}

function startStockTokenDetailsRequest<T>({
  dedupingInterval,
  request,
  scope,
}: {
  dedupingInterval: number;
  request: () => Promise<T>;
  scope: string;
}): Promise<T> {
  const pendingEntry: IStockTokenDetailsPendingRequest = {
    request: Promise.resolve(undefined),
  };
  const nextRequest = Promise.resolve().then(request);
  const managedRequest = nextRequest.then(
    (result) => {
      if (
        stockTokenDetailsPendingRequestMap.get(scope) === pendingEntry &&
        !pendingEntry.queuedRevalidation
      ) {
        stockTokenDetailsPendingRequestMap.delete(scope);
        stockTokenDetailsSettledResultCache.set(scope, {
          expiresAt: Date.now() + dedupingInterval,
          result,
        });
      }
      return result;
    },
    (error: unknown) => {
      if (
        stockTokenDetailsPendingRequestMap.get(scope) === pendingEntry &&
        !pendingEntry.queuedRevalidation
      ) {
        stockTokenDetailsPendingRequestMap.delete(scope);
      }
      throw error;
    },
  );
  pendingEntry.request = managedRequest;
  stockTokenDetailsPendingRequestMap.set(scope, pendingEntry);
  return managedRequest;
}

function queueStockTokenDetailsRevalidation<T>({
  dedupingInterval,
  pendingEntry,
  request,
  scope,
}: {
  dedupingInterval: number;
  pendingEntry: IStockTokenDetailsPendingRequest;
  request: () => Promise<T>;
  scope: string;
}): Promise<T> {
  if (pendingEntry.queuedRevalidation) {
    return pendingEntry.queuedRevalidation as Promise<T>;
  }

  const queuedRevalidation = pendingEntry.request
    .catch(() => undefined)
    .then(() => {
      pendingEntry.queuedRevalidation = undefined;
      return startStockTokenDetailsRequest({
        dedupingInterval,
        request,
        scope,
      });
    });
  pendingEntry.queuedRevalidation = queuedRevalidation;
  return queuedRevalidation;
}

export async function runStockPayTokenDetailsRequest<T>({
  dedupingInterval = STOCK_PAY_TOKEN_DETAILS_DEDUPING_INTERVAL_MS,
  mode = 'dedupe',
  request,
  scope,
}: {
  dedupingInterval?: number;
  mode?: IStockTokenDetailsRequestMode;
  request: () => Promise<T>;
  scope: string;
}): Promise<T> {
  const pendingEntry = stockTokenDetailsPendingRequestMap.get(scope);
  if (pendingEntry) {
    if (mode === 'revalidate') {
      return queueStockTokenDetailsRevalidation({
        dedupingInterval,
        pendingEntry,
        request,
        scope,
      });
    }
    return (pendingEntry.queuedRevalidation ??
      pendingEntry.request) as Promise<T>;
  }

  if (mode === 'dedupe') {
    const cachedResult = readStockTokenDetailsSettledResult<T>(scope);
    if (cachedResult) {
      return cachedResult.result;
    }
  } else {
    stockTokenDetailsSettledResultCache.delete(scope);
  }

  return startStockTokenDetailsRequest({
    dedupingInterval,
    request,
    scope,
  });
}

export function buildStockTokenDetailsRequestScope({
  accountAddress,
  accountId,
  contractAddress,
  currency,
  networkId,
  protocol,
}: {
  accountAddress: string;
  accountId: string;
  contractAddress?: string;
  currency: string;
  networkId: string;
  protocol: string;
}) {
  return [
    protocol,
    networkId,
    contractAddress?.toLowerCase() ?? '',
    accountId,
    accountAddress.toLowerCase(),
    currency.toLowerCase(),
  ].join(':');
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
