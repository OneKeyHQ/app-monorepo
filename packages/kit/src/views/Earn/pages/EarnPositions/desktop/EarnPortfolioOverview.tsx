import { useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import { buildValueShares } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHome.utils';
import type { IEarnDesktopShareToken } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHome.utils';
import { ProtocolSplit } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/EarnDesktopProtocolSplit';

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
 * protocols up: the home hero's split bar (lightness steps, whole percents,
 * the rest as "N more"). Each protocol counts what its card's header reads,
 * so the bar and the cards agree. The wallet DeFi Portfolio's protocol tiles
 * stood under it until 11-12: every protocol's value is in its card's header
 * right below, and the tiles listed by network what the bar lists by
 * protocol.
 */
export function EarnPortfolioOverview({
  protocols,
  onOpenSplitProtocols,
}: {
  /** the protocol cards shown, after the network filter */
  protocols: IEarnProtocolView[];
  /** a share of the bar: its protocol's cards across networks */
  onOpenSplitProtocols?: (protocolKeys: string[]) => void;
}) {
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

  if (protocols.length < 2 || shares.top.length === 0) {
    return null;
  }
  return (
    <YStack px="$5" userSelect="none">
      <ProtocolSplit shares={shares} onOpenProtocols={onOpenSplitProtocols} />
    </YStack>
  );
}
