import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

type IFetchUserAbstractionRawParams = {
  accountAddress: IHex;
};

export type IFetchUserAbstractionRawWithCache = ((
  params: IFetchUserAbstractionRawParams,
) => Promise<string>) & {
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
  return cacheUtils.memoizee(
    async ({ accountAddress }: IFetchUserAbstractionRawParams) => {
      const lowerAddress = accountAddress.toLowerCase() as IHex;
      const mode = await fetchRaw(lowerAddress);
      if (!mode) {
        throw new OneKeyLocalError('userAbstraction empty result, skip cache');
      }
      return mode;
    },
    {
      max: 20,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
      normalizer: normalizeUserAbstractionRawCacheKey,
      promise: true,
    },
  ) as IFetchUserAbstractionRawWithCache;
}

export function invalidateUserAbstractionRawCache(
  fetchWithCache: IFetchUserAbstractionRawWithCache,
  accountAddress: IHex,
) {
  fetchWithCache.delete({
    accountAddress: accountAddress.toLowerCase() as IHex,
  });
}
