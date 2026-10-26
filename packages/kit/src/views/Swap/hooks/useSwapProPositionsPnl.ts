import { useMemo, useState } from 'react';

import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAccountPortfolioPnl } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

const EMPTY_PNL_MAP = new Map<string, IMarketAccountPortfolioPnl>();
const PNL_REFRESH_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 30 });

export function useSwapProPositionsPnl(tokens: ISwapToken[]) {
  const isMounted = useIsMounted();
  const [fetchPnl] = useState(() => {
    const requests = new LRUCache<
      string,
      {
        promise: Promise<IMarketAccountPortfolioPnl | undefined>;
        resolvedAt?: number;
      }
    >({ max: 500 });
    const limit = pLimit(4);

    return (token: ISwapToken) => {
      const { networkId, accountAddress, contractAddress } = token;
      if (!accountAddress) return Promise.resolve(undefined);
      const key = JSON.stringify([networkId, accountAddress, contractAddress]);
      const cached = requests.get(key);
      if (
        cached &&
        (cached.resolvedAt === undefined ||
          Date.now() - cached.resolvedAt < PNL_REFRESH_INTERVAL)
      ) {
        return cached.promise;
      }

      // Keep this cache local to PNL display; trading balance reads stay fresh.
      const pending = limit(async () => {
        if (!isMounted.current) return undefined;
        const data =
          await backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio({
            networkId,
            accountAddress,
            tokenAddress: contractAddress,
            throwOnError: true,
          });
        const current = requests.get(key);
        if (current?.promise === pending) current.resolvedAt = Date.now();
        return data.list?.[0]?.pnl;
      }).catch((error: unknown) => {
        if (requests.get(key)?.promise === pending) requests.delete(key);
        throw error;
      });
      requests.set(key, { promise: pending });
      return pending;
    };
  });
  const tokenKeys = useMemo(
    () =>
      tokens
        .map((t) => `${t.networkId}-${t.contractAddress}-${t.accountAddress}`)
        .toSorted()
        .join(','),
    [tokens],
  );

  const { result: pnlMap } = usePromiseResult(
    async () => {
      if (tokens.length === 0) {
        return EMPTY_PNL_MAP;
      }

      const results = await Promise.all(
        tokens.map(async (token) => {
          if (!token.accountAddress) {
            return { key: '', pnl: undefined };
          }
          try {
            return {
              key: `${token.networkId}-${token.contractAddress}`,
              pnl: await fetchPnl(token),
            };
          } catch {
            return {
              key: `${token.networkId}-${token.contractAddress}`,
              pnl: undefined,
            };
          }
        }),
      );

      const map = new Map<string, IMarketAccountPortfolioPnl>();
      for (const { key, pnl } of results) {
        if (key && pnl) {
          map.set(key, pnl);
        }
      }
      return map;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tokenKeys, fetchPnl],
    {
      pollingInterval: PNL_REFRESH_INTERVAL,
    },
  );

  return pnlMap ?? EMPTY_PNL_MAP;
}
