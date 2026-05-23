import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

type IFetchUserAbstractionRawParams = {
  accountAddress: IHex;
};

export type IFetchUserAbstractionRawWithCache = ((
  params: IFetchUserAbstractionRawParams,
) => Promise<string | undefined>) & {
  clear: () => void;
  delete: (params: IFetchUserAbstractionRawParams) => void;
};

export function normalizeUserAbstractionRawCacheKey([{ accountAddress }]: [
  IFetchUserAbstractionRawParams,
]) {
  return accountAddress.toLowerCase();
}

export function createFetchUserAbstractionRawWithCache(
  fetchRaw: (accountAddress: IHex) => Promise<string | undefined | null>,
): IFetchUserAbstractionRawWithCache {
  const fetchWithCache = cacheUtils.memoizee(
    async ({ accountAddress }: IFetchUserAbstractionRawParams) => {
      const lowerAddress = accountAddress.toLowerCase() as IHex;
      return fetchRaw(lowerAddress);
    },
    {
      max: 20,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
      normalizer: normalizeUserAbstractionRawCacheKey,
      promise: true,
    },
  ) as IFetchUserAbstractionRawWithCache;

  const fetchWithoutEmptyCache = (async (
    params: IFetchUserAbstractionRawParams,
  ) => {
    const mode = await fetchWithCache(params);
    if (!mode) {
      fetchWithCache.delete(params);
      return undefined;
    }
    return mode;
  }) as IFetchUserAbstractionRawWithCache;

  fetchWithoutEmptyCache.clear = fetchWithCache.clear.bind(fetchWithCache);
  fetchWithoutEmptyCache.delete = fetchWithCache.delete.bind(fetchWithCache);
  return fetchWithoutEmptyCache;
}

export function invalidateUserAbstractionRawCache(
  fetchWithCache: IFetchUserAbstractionRawWithCache,
  accountAddress: IHex,
) {
  fetchWithCache.delete({
    accountAddress: accountAddress.toLowerCase() as IHex,
  });
}
