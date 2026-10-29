import { useMemo, useRef, useState } from 'react';

import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAccountPortfolioPnl } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

const PNL_REFRESH_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 30 });

function getPnlTokenKey(token: ISwapToken) {
  return JSON.stringify([
    token.networkId,
    token.accountAddress,
    token.contractAddress,
  ]);
}

export function useSwapProPositionsPnl(tokens: ISwapToken[]) {
  const isMounted = useIsMounted();
  const activeTokens = useRef(new Map<string, ISwapToken>());
  activeTokens.current = new Map(
    tokens.map((token) => [getPnlTokenKey(token), token]),
  );
  const [pnlByToken, setPnlByToken] = useState(
    () => new Map<string, IMarketAccountPortfolioPnl>(),
  );
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
      if (!accountAddress) return;
      const key = getPnlTokenKey(token);
      let request = requests.get(key);
      if (
        !request ||
        (request.resolvedAt !== undefined &&
          Date.now() - request.resolvedAt >= PNL_REFRESH_INTERVAL)
      ) {
        const promise = limit(async () => {
          // Queued work belongs to its original account/token scope.
          if (!isMounted.current || !activeTokens.current.has(key)) {
            if (requests.get(key)?.promise === promise) requests.delete(key);
            return undefined;
          }
          const data =
            await backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio(
              {
                networkId,
                accountAddress,
                tokenAddress: contractAddress,
                throwOnError: true,
              },
            );
          const current = requests.get(key);
          if (current?.promise === promise) current.resolvedAt = Date.now();
          return data.list?.[0]?.pnl;
        });
        request = { promise };
        requests.set(key, request);
      }
      const currentRequest = request;
      void request.promise
        .then((pnl) => {
          if (
            !isMounted.current ||
            !activeTokens.current.has(key) ||
            requests.get(key) !== currentRequest
          )
            return;
          setPnlByToken((previous) => {
            if (previous.get(key) === pnl) return previous;
            const next = new Map(
              [...previous].filter(([entryKey]) =>
                activeTokens.current.has(entryKey),
              ),
            );
            if (pnl) next.set(key, pnl);
            else next.delete(key);
            return next;
          });
        })
        .catch(() => {
          if (requests.get(key) === currentRequest) requests.delete(key);
        });
    };
  });
  const tokenKeys = useMemo(
    () => tokens.map(getPnlTokenKey).toSorted().join(','),
    [tokens],
  );
  usePromiseResult(
    () => {
      // Poll independently of slow requests; the per-token cache owns in-flight deduplication.
      if (tokenKeys) activeTokens.current.forEach(fetchPnl);
      return Promise.resolve();
    },
    [tokenKeys, fetchPnl],
    {
      pollingInterval: tokens.length ? PNL_REFRESH_INTERVAL : undefined,
    },
  );

  return useMemo(() => {
    const pnlMap = new Map<string, IMarketAccountPortfolioPnl>();
    for (const token of tokens) {
      const pnl = pnlByToken.get(getPnlTokenKey(token));
      if (pnl) pnlMap.set(`${token.networkId}-${token.contractAddress}`, pnl);
    }
    return pnlMap;
  }, [pnlByToken, tokens]);
}
