import { useMemo } from 'react';

import { Empty, YStack } from '@onekeyhq/components';
import type {
  IEarnPortfolioInvestment,
  IEarnRewardsPortfolioGroup,
} from '@onekeyhq/shared/types/staking';

import { WrappedActionButton } from '../../../components/PortfolioTabContent';
import { resolveUniquePortfolioClaimSourceIdentity } from '../../../utils/portfolioClaimUtils';

import { useGroupExpansion } from './GroupRow';
import {
  buildClaimSourceCandidates,
  groupInvestmentsByProvider,
  selectProtocolClaimableInvestments,
  toLedgerClaimAsset,
} from './myPortfolio.utils';
import { ProtocolGroupRow } from './ProtocolGroupRow';
import { RewardsLedgerList } from './RewardsLedgerList';

import type { IPositionManageHandler } from './myPortfolio.utils';

/**
 * Claimable (product: split by what the user has to do, not by where the
 * reward comes from): everything the user has to
 * claim by hand that the header also counts. Two shapes in one list —
 *   - on-chain airdrop rows of non-ledger providers (Morpho / Lista /
 *     Pendle), rendered as the position card in its rewards-only variant
 *     (claim happens on the detail page behind Manage);
 *   - Campaign / airdrop rows from the ledger, rendered as the detail page's
 *     reward row with an inline Claim button, because some of those rows
 *     cannot resolve to a detail page at all.
 * A position's own reward rows are not listed until the server sizes them.
 */
export function RewardsClaimableList({
  investments,
  ledgerGroups,
  emptyTitle,
  onManage,
}: {
  investments: IEarnPortfolioInvestment[];
  ledgerGroups: IEarnRewardsPortfolioGroup[];
  emptyTitle: string;
  onManage: IPositionManageHandler;
}) {
  const expansion = useGroupExpansion();
  const protocolGroups = useMemo(
    () =>
      groupInvestmentsByProvider(
        selectProtocolClaimableInvestments(investments),
      ),
    [investments],
  );
  const candidates = useMemo(
    () => buildClaimSourceCandidates(investments),
    [investments],
  );
  const networkInfoById = useMemo(() => {
    const map = new Map<string, { name: string; logoURI: string }>();
    investments.forEach((investment) => {
      map.set(investment.network.networkId, {
        name: investment.network.name,
        logoURI: investment.network.logoURI,
      });
    });
    return map;
  }, [investments]);

  if (protocolGroups.length === 0 && ledgerGroups.length === 0) {
    return <Empty icon="GiftOutline" title={emptyTitle} />;
  }

  return (
    <YStack gap="$4">
      {protocolGroups.map((group, index) => (
        <ProtocolGroupRow
          key={group.key}
          group={group}
          expanded={expansion.isExpanded(group.key, index)}
          onToggle={() => expansion.toggle(group.key, index)}
          rewardsOnly
          onManage={onManage}
        />
      ))}
      <RewardsLedgerList
        groups={ledgerGroups}
        expansion={expansion}
        indexOffset={protocolGroups.length}
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
