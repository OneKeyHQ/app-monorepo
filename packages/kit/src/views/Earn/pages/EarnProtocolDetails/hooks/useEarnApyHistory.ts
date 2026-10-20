import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

/**
 * APY history for the detail page, loaded once: the APY chart draws it, and
 * Pendle's rules chart turns the implied APY into the PT price.
 */
export function useEarnApyHistory({
  networkId,
  symbol,
  provider,
  vault,
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
}) {
  const isPendleProvider = useMemo(
    () => earnUtils.isPendleProvider({ providerName: provider }),
    [provider],
  );

  const { result: chartData, isLoading: isChartLoading } = usePromiseResult(
    async () => {
      if (isPendleProvider) {
        // underlying-history returns both impliedApy and underlyingApy, single request suffices
        const underlyingApyHistoryData =
          await backgroundApiProxy.serviceStaking.getUnderlyingApyHistory({
            networkId,
            symbol,
            provider,
            vault,
          });

        const impliedApyHistory = underlyingApyHistoryData.results.map(
          (item) => ({
            timestamp: item.timestamp,
            apy: item.impliedApy,
          }),
        );

        const underlyingApyHistory = underlyingApyHistoryData.results.map(
          (item) => ({
            timestamp: item.timestamp,
            apy: item.underlyingApy,
          }),
        );

        return {
          impliedApyHistory,
          underlyingApyHistory,
          hasNonZeroUnderlyingApy:
            underlyingApyHistoryData.hasNonZeroUnderlyingApy,
        };
      }

      const impliedApyHistory =
        await backgroundApiProxy.serviceStaking.getApyHistory({
          networkId,
          symbol,
          provider,
          vault,
        });

      // Second line = campaign boost + protocol reward APYs, summed by the
      // server. It keeps every base point and leaves the ones without an extra
      // APY empty: a history that predates the campaign starts the line later
      // instead of dropping to zero, and a campaign that stopped and resumed
      // breaks the line instead of joining the two runs straight across the
      // weeks in between (OK-64549).
      const extraApyHistory = impliedApyHistory.some(
        (item) => item.extraApy !== undefined,
      )
        ? impliedApyHistory.map((item) => ({
            timestamp: item.timestamp,
            apy: item.extraApy,
          }))
        : [];
      // Campaign wins over reward, matching the rule the server applies per
      // point ("a campaign present at all makes the line orange") and the
      // headline's split. Taking the first point that happens to carry a kind
      // would paint a window that starts with plain rewards and later gains a
      // campaign entirely blue, and label it Rewards.
      const extraApyKind = impliedApyHistory.some(
        (item) => item.extraApyKind === 'campaign',
      )
        ? ('campaign' as const)
        : impliedApyHistory.find((item) => item.extraApyKind)?.extraApyKind;

      return {
        impliedApyHistory,
        extraApyHistory,
        extraApyKind,
      };
    },
    [networkId, symbol, provider, vault, isPendleProvider],
    // Settles to false when the request fails too, so a chart waiting on the
    // history can leave its skeleton.
    { watchLoading: true },
  );

  return { chartData, isChartLoading };
}

export type IEarnApyHistory = ReturnType<typeof useEarnApyHistory>;
