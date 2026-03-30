import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAccountPortfolioPnl } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

const EMPTY_PNL_MAP = new Map<string, IMarketAccountPortfolioPnl>();

export function useSwapProPositionsPnl(tokens: ISwapToken[]) {
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
            const data =
              await backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio(
                {
                  networkId: token.networkId,
                  accountAddress: token.accountAddress,
                  tokenAddress: token.contractAddress,
                },
              );
            const item = data.list?.[0];
            return {
              key: `${token.networkId}-${token.contractAddress}`,
              pnl: item?.pnl,
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
    [tokenKeys],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  return pnlMap ?? EMPTY_PNL_MAP;
}
