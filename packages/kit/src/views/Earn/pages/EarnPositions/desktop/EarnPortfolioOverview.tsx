import { useCallback, useMemo } from 'react';

import { YStack, useMedia } from '@onekeyhq/components';
import { ProviderJotaiContextDeFiList } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { buildValueShares } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHome.utils';
import type { IEarnDesktopShareToken } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHome.utils';
import { ProtocolSplit } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/EarnDesktopProtocolSplit';
import { useEarnDesktopSurfaces } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/useEarnDesktopSurfaces';
import { DeFiOverviewGrid } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/DeFiOverviewGrid';
import { resolveOverviewCols } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/overviewColsResolver';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import type { IEarnProtocolView } from '../mobile/earnPositionModel';

// What a protocol's cards hold (deposited and supplied rows, the most
// valuable first, each symbol once) and what they owe
function describeProtocolHoldings(protocol: IEarnProtocolView) {
  const held = new Map<string, IEarnDesktopShareToken & { value: number }>();
  let debtValue = 0;
  protocol.positions.forEach((position) =>
    position.sections.forEach((section) => {
      if (section.kind === 'borrowed') {
        section.assets.forEach((asset) => {
          debtValue += Math.abs(asset.value || 0);
        });
        return;
      }
      if (section.kind !== 'deposited' && section.kind !== 'supplied') {
        return;
      }
      section.assets.forEach((asset) => {
        const key = asset.symbol.toUpperCase();
        const current = held.get(key);
        held.set(key, {
          symbol: current?.symbol ?? asset.symbol,
          logoURI: current?.logoURI ?? asset.meta?.logoUrl,
          value: (current?.value ?? 0) + (asset.value || 0),
        });
      });
    }),
  );
  return {
    tokens: [...held.values()]
      .toSorted((a, b) => b.value - a.value)
      .map(({ symbol, logoURI }) => ({ symbol, logoURI })),
    debtValue,
  };
}

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
  onOpenSplitProtocols,
}: {
  /** the protocol cards shown, after the network filter */
  protocols: IEarnProtocolView[];
  /** the wallet protocols behind them */
  deFiProtocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  onPressProtocol: (protocol: IDeFiProtocol) => void;
  /** a share of the bar: its protocol's cards across networks */
  onOpenSplitProtocols?: (protocolKeys: string[]) => void;
}) {
  const media = useMedia();
  // The DeFi home's card colors, so the tiles read as the home's cards do
  const { rest, hover, press } = useEarnDesktopSurfaces();
  const tileSurface = useMemo(
    () => ({ rest, hover, press }),
    [rest, hover, press],
  );
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
  // By protocol across networks, as the home splits its total, with what
  // each holds and owes for the bar's hover cards
  const shares = useMemo(
    () =>
      buildValueShares({
        items: protocols.map((protocol) => {
          const { tokens, debtValue } = describeProtocolHoldings(protocol);
          return {
            key: protocol.protocol.toLowerCase(),
            name: protocol.name,
            logoURI: protocol.logoURI,
            value: protocol.value.value,
            tokens,
            debtValue: debtValue || undefined,
          };
        }),
      }),
    [protocols],
  );

  if (shownProtocols.length < 2 || shares.top.length === 0) {
    return null;
  }
  return (
    <ProviderJotaiContextDeFiList>
      <YStack px="$5" gap="$6" userSelect="none">
        <ProtocolSplit shares={shares} onOpenProtocols={onOpenSplitProtocols} />
        <DeFiOverviewGrid
          cols={cols}
          protocols={shownProtocols}
          protocolMap={protocolMap}
          getNetWorth={getNetWorth}
          onPressProtocol={onPressProtocol}
          isAllNetworks
          tileSurface={tileSurface}
        />
      </YStack>
    </ProviderJotaiContextDeFiList>
  );
}
