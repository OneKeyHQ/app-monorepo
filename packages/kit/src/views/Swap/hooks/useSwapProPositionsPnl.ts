import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIdentityScopedSilentRefresh } from '@onekeyhq/kit/src/hooks/useIdentityScopedSilentRefresh';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAccountPortfolioPnl } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

const EMPTY_PNL_MAP = new Map<string, IMarketAccountPortfolioPnl>();
const PNL_REFRESH_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 30 });

export function useSwapProPositionsPnl(
  tokens: ISwapToken[],
  positionOwnerKey?: string,
) {
  const tokenKeys = useMemo(
    () =>
      tokens
        .map((token) =>
          [token.networkId, token.contractAddress, token.accountAddress].join(
            '-',
          ),
        )
        .toSorted()
        .join(','),
    [tokens],
  );
  const pnlOwnerKey = positionOwnerKey
    ? `${positionOwnerKey}::${tokens
        .map((token) => `${token.networkId}-${token.accountAddress ?? ''}`)
        .toSorted()
        .join(',')}`
    : '';
  const pnlRefresh = useIdentityScopedSilentRefresh<
    Map<string, IMarketAccountPortfolioPnl>
  >({
    enabled: Boolean(pnlOwnerKey && tokenKeys),
    ownerKey: pnlOwnerKey,
    requestKey: tokenKeys,
    load: async () => {
      const results = await Promise.all(
        tokens.map(async (token) => {
          if (!token.accountAddress) {
            return { key: '', pnl: undefined };
          }
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
        }),
      );

      const map = new Map<string, IMarketAccountPortfolioPnl>();
      for (const { key, pnl } of results) {
        if (key && pnl) {
          map.set(key, pnl);
        }
      }
      return { status: 'success', data: map };
    },
  });

  useInterval(
    pnlRefresh.refresh,
    pnlOwnerKey && tokenKeys ? PNL_REFRESH_INTERVAL : undefined,
  );

  return pnlRefresh.visible?.data ?? EMPTY_PNL_MAP;
}
