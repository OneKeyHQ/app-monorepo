import BigNumber from 'bignumber.js';

import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type {
  IDeFiProtocol,
  IFetchAccountDeFiPositionsResp,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

export type IDeFiPositionResult = {
  overview: IFetchAccountDeFiPositionsResp['data']['totals'];
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  isSameAllNetworksAccountData?: boolean;
};

export type IDeFiOverview = IDeFiPositionResult['overview'];

export function buildSingleNetworkDeFiCacheKey({
  accountId,
  networkId,
  accountAddress,
}: {
  accountId: string;
  networkId: string;
  accountAddress?: string;
}) {
  return `${accountId}:${networkId}:${accountAddress ?? ''}`;
}

export function buildDeFiListOwnerKey({
  accountId,
  networkId,
}: {
  accountId?: string;
  networkId?: string;
}) {
  if (!accountId || !networkId) return undefined;
  return `${accountId}:${networkId}`;
}

export function convertDeFiOverviewValues(
  overview: Pick<
    IDeFiOverview,
    'totalValue' | 'totalDebt' | 'totalReward' | 'netWorth'
  >,
  sourceCurrencyValue: string,
  targetCurrencyValue: string,
) {
  const convert = (value: number) =>
    new BigNumber(value)
      .div(sourceCurrencyValue)
      .times(targetCurrencyValue)
      .toNumber();
  return {
    totalValue: convert(overview.totalValue),
    totalDebt: convert(overview.totalDebt),
    totalReward: convert(overview.totalReward),
    netWorth: convert(overview.netWorth),
  };
}

export function mergeDeFiPositionResults(
  results: IDeFiPositionResult[],
): IDeFiPositionResult {
  const overview: IDeFiOverview = {
    totalValue: 0,
    totalDebt: 0,
    totalReward: 0,
    netWorth: 0,
    chains: [],
    protocolCount: 0,
    positionCount: 0,
  };
  const protocols: IDeFiProtocol[] = [];
  const protocolMap: Record<string, IProtocolSummary> = {};

  results.forEach((result) => {
    overview.totalValue = new BigNumber(overview.totalValue)
      .plus(result.overview.totalValue)
      .toNumber();
    overview.totalDebt = new BigNumber(overview.totalDebt)
      .plus(result.overview.totalDebt)
      .toNumber();
    overview.totalReward = new BigNumber(overview.totalReward)
      .plus(result.overview.totalReward)
      .toNumber();
    overview.netWorth = new BigNumber(overview.netWorth)
      .plus(result.overview.netWorth)
      .toNumber();
    overview.chains = Array.from(
      new Set([...overview.chains, ...result.overview.chains]),
    );
    overview.protocolCount += result.overview.protocolCount;
    overview.positionCount += result.overview.positionCount;
    protocols.push(...result.protocols);
    Object.assign(protocolMap, result.protocolMap);
  });

  return { overview, protocols, protocolMap };
}

export function sortDeFiProtocolsByNetWorth({
  protocols,
  protocolMap,
}: {
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
}) {
  return protocols.toSorted((a, b) =>
    new BigNumber(
      protocolMap[
        defiUtils.buildProtocolMapKey({
          protocol: b.protocol,
          networkId: b.networkId,
        })
      ]?.netWorth ?? 0,
    ).comparedTo(
      new BigNumber(
        protocolMap[
          defiUtils.buildProtocolMapKey({
            protocol: a.protocol,
            networkId: a.networkId,
          })
        ]?.netWorth ?? 0,
      ),
    ),
  );
}

export function mergeDeFiOverviewCurrency({
  overview,
  sourceCurrencyInfo,
  targetCurrencyInfo,
}: {
  overview: Pick<
    IDeFiOverview,
    'totalValue' | 'totalDebt' | 'totalReward' | 'netWorth'
  > & { currency?: string };
  sourceCurrencyInfo?: ICurrencyItem;
  targetCurrencyInfo?: ICurrencyItem;
}) {
  if (
    !sourceCurrencyInfo ||
    !targetCurrencyInfo ||
    overview.currency === targetCurrencyInfo.id
  ) {
    return overview;
  }

  return {
    ...overview,
    ...convertDeFiOverviewValues(
      overview,
      sourceCurrencyInfo.value,
      targetCurrencyInfo.value,
    ),
  };
}
