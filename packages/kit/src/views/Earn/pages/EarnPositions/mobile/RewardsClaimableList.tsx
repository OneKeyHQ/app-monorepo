import { useMemo } from 'react';

import { Empty, YStack } from '@onekeyhq/components';
import type { IEarnPortfolioPosition } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type { IEarnRewardsPortfolioGroup } from '@onekeyhq/shared/types/staking';

import { WrappedActionButton } from '../../../components/PortfolioTabContent';
import { resolveUniquePortfolioClaimSourceIdentity } from '../../../utils/portfolioClaimUtils';

import { EarnPositionProtocolList } from './EarnPositionProtocolList';
import { useGroupExpansion } from './GroupRow';
import {
  buildClaimSourceCandidates,
  buildNetworkInfoMap,
  toLedgerClaimAsset,
} from './myPortfolio.utils';
import { RewardsLedgerList } from './RewardsLedgerList';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type { IEarnProtocolView } from './earnPositionModel';

/**
 * Claimable (product: split by what the user has to do, not by where the
 * reward comes from): everything the user has to claim by hand that the
 * header also counts. Two shapes in one list —
 *   - the positions' claimable rewards, as the position card cut down to
 *     its Rewards section (claim happens on the detail page behind Manage);
 *   - Campaign / airdrop rows from the ledger, rendered as the detail page's
 *     reward row with an inline Claim button, because some of those rows
 *     cannot resolve to a detail page at all.
 * Claimable principal is a position of its own on DeFi Assets, never here.
 */
export function RewardsClaimableList({
  protocols,
  positions,
  ledgerGroups,
  emptyTitle,
  onManage,
}: {
  protocols: IEarnProtocolView[];
  positions: IEarnPortfolioPosition[];
  ledgerGroups: IEarnRewardsPortfolioGroup[];
  emptyTitle: string;
} & IEarnPositionCardHandlers) {
  const expansion = useGroupExpansion();
  const candidates = useMemo(
    () => buildClaimSourceCandidates(positions),
    [positions],
  );
  const networkInfoById = useMemo(
    () => buildNetworkInfoMap(positions),
    [positions],
  );

  if (protocols.length === 0 && ledgerGroups.length === 0) {
    return <Empty icon="GiftOutline" title={emptyTitle} />;
  }

  return (
    <YStack gap="$4">
      <EarnPositionProtocolList
        protocols={protocols}
        expansion={expansion}
        onManage={onManage}
      />
      <RewardsLedgerList
        groups={ledgerGroups}
        expansion={expansion}
        renderAction={(group, item) => {
          const network = networkInfoById.get(group.networkId);
          const asset = toLedgerClaimAsset({
            group,
            item,
            networkName: network?.name ?? '',
            networkLogoURI: network?.logoURI ?? '',
          });
          const reward = asset?.airdropAssets[0];
          if (!asset || !reward) {
            return null;
          }
          return (
            <WrappedActionButton
              asset={asset}
              reward={reward}
              claimSourceIdentity={resolveUniquePortfolioClaimSourceIdentity({
                networkId: group.networkId,
                providerName: group.provider,
                candidates,
              })}
              rewardSymbol={item.token.info.symbol}
            />
          );
        }}
      />
    </YStack>
  );
}
