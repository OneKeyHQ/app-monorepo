import { useCallback, useMemo } from 'react';

import { YStack, useMedia } from '@onekeyhq/components';
import { ProviderJotaiContextDeFiList } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { buildValueShares } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHome.utils';
import { ProtocolSplit } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/EarnDesktopProtocolSplit';
import { DeFiOverviewGrid } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/DeFiOverviewGrid';
import { resolveOverviewCols } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/overviewColsResolver';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import type { IEarnProtocolView } from '../mobile/earnPositionModel';

/**
 * The wide layout's allocation overview over the positions shown, from two
 * protocols up as the wallet does: the home hero's split bar (lightness
 * steps, whole percents, the rest as "N more"), then the wallet DeFi
 * Portfolio's protocol tiles. Each protocol counts what its card's header
 * reads, so the bar, a tile and its card agree. The tiles keep their "More"
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
  const media = useMedia();
  const cols = useMemo(
    () => resolveOverviewCols({ gtXl: media.gtXl, gtLg: media.gtLg }),
    [media.gtXl, media.gtLg],
  );
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
  // By protocol across networks, as the home splits its total
  const shares = useMemo(
    () =>
      buildValueShares({
        items: protocols.map((protocol) => ({
          key: protocol.protocol.toLowerCase(),
          name: protocol.name,
          logoURI: protocol.logoURI,
          value: protocol.value.value,
        })),
      }),
    [protocols],
  );

  if (shownProtocols.length < 2 || shares.top.length === 0) {
    return null;
  }
  return (
    <ProviderJotaiContextDeFiList>
      <YStack px="$5" gap="$6" userSelect="none">
        <ProtocolSplit shares={shares} />
        <DeFiOverviewGrid
          cols={cols}
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
