import { useCallback, useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import { ProviderJotaiContextDeFiList } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { DeFiAllocationCard } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/DeFiAllocationCard';
import { buildPortfolioStats } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/DeFiPortfolioStats';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import type { IEarnProtocolView } from '../mobile/earnPositionModel';

/**
 * The wide layout's allocation overview: the wallet DeFi Portfolio's own
 * stacked bar and protocol tiles over the positions shown, shown from two
 * protocols up as the wallet does. Each protocol counts what its card's
 * header reads, so a tile and its card agree. The tiles keep their "More"
 * state in a DeFi list store of their own.
 */
export function EarnPortfolioOverview({
  protocols,
  deFiProtocols,
  protocolMap,
  onPressProtocol,
}: {
  /** the protocol cards shown, after the network filter */
  protocols: IEarnProtocolView[];
  /** the wallet protocols behind them */
  deFiProtocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  onPressProtocol: (protocol: IDeFiProtocol) => void;
}) {
  const valueByKey = useMemo(
    () =>
      new Map(
        protocols.map((protocol) => [protocol.key, protocol.value.value]),
      ),
    [protocols],
  );
  const shownProtocols = useMemo(
    () =>
      deFiProtocols.filter((protocol) =>
        valueByKey.has(
          defiUtils.buildProtocolMapKey({
            protocol: protocol.protocol,
            networkId: protocol.networkId,
          }),
        ),
      ),
    [deFiProtocols, valueByKey],
  );
  const getNetWorth = useCallback(
    (protocol: IDeFiProtocol) =>
      valueByKey.get(
        defiUtils.buildProtocolMapKey({
          protocol: protocol.protocol,
          networkId: protocol.networkId,
        }),
      ) ?? 0,
    [valueByKey],
  );
  const stats = useMemo(
    () =>
      buildPortfolioStats({
        protocols: shownProtocols,
        protocolMap,
        getNetWorth,
      }),
    [shownProtocols, protocolMap, getNetWorth],
  );

  if (shownProtocols.length < 2 || stats.slices.length === 0) {
    return null;
  }
  return (
    <ProviderJotaiContextDeFiList>
      <YStack px="$5">
        <DeFiAllocationCard
          stats={stats}
          protocols={shownProtocols}
          protocolMap={protocolMap}
          getNetWorth={getNetWorth}
          onPressProtocol={onPressProtocol}
          isAllNetworks
        />
      </YStack>
    </ProviderJotaiContextDeFiList>
  );
}
