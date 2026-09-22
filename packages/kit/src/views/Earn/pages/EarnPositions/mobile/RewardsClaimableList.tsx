import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnPortfolioInvestment,
  IEarnRewardsPortfolioGroup,
} from '@onekeyhq/shared/types/staking';

import { WrappedActionButton } from '../../../components/PortfolioTabContent';
import { resolveUniquePortfolioClaimSourceIdentity } from '../../../utils/portfolioClaimUtils';

import {
  buildClaimSourceCandidates,
  groupInvestmentsByProvider,
  selectProtocolClaimableInvestments,
  toLedgerClaimAsset,
} from './myPortfolio.utils';
import { PositionCard } from './PositionCard';
import { RewardsLedgerList } from './RewardsLedgerList';

/**
 * Claimable (product: "只区分行为,不区分来源"): everything the user has to
 * claim by hand. Two shapes in one list —
 *   - protocol rewards a position accrued, rendered as the position card
 *     (claim happens on the detail page behind Manage);
 *   - Campaign / airdrop rows from the ledger, rendered as the detail page's
 *     reward row with an inline Claim button, because some of those rows
 *     cannot resolve to a detail page at all.
 */
export function RewardsClaimableList({
  investments,
  ledgerGroups,
  onManage,
}: {
  investments: IEarnPortfolioInvestment[];
  ledgerGroups: IEarnRewardsPortfolioGroup[];
  onManage: (investment: IEarnPortfolioInvestment) => void;
}) {
  const intl = useIntl();
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
    return (
      <Empty
        icon="GiftOutline"
        title={intl.formatMessage({
          id: ETranslations.earn_no_assets_deposited,
        })}
      />
    );
  }

  return (
    <YStack gap="$4" py="$2">
      {protocolGroups.map((group) => (
        <YStack key={group.key} px="$5" gap="$3">
          {group.investments.map((investment) => (
            <PositionCard
              key={`${investment.protocol.providerDetail.code}-${investment.protocol.symbol ?? ''}-${investment.protocol.vault ?? ''}-${investment.network.networkId}`}
              investment={investment}
              rewardsOnly
              onManage={onManage}
            />
          ))}
        </YStack>
      ))}
      <RewardsLedgerList
        groups={ledgerGroups}
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
