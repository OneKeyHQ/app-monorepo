import { useMemo } from 'react';

import { Empty, Spinner, Stack, YStack } from '@onekeyhq/components';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import type { IEarnRewardsPortfolioGroup } from '@onekeyhq/shared/types/staking';

import { ClaimableRewardRow } from './ClaimableRewardRow';
import { GroupRow } from './GroupRow';
import { LedgerRewardCard } from './LedgerRewardCard';
import { mergeRewardGroups } from './myPortfolio.utils';
import { RewardsGroupTotal } from './RewardsClaimableList';

import type { IEarnPositionRewardGroup } from './earnPositionModel';
import type { IGroupExpansion } from './GroupRow';

/**
 * Pending (product 10-12): every reward on its way that the user cannot
 * claim yet, under one group per protocol per network —
 *   - the positions' rewards the server marked pending: accruing until the
 *     next settlement (Morpho, Lista) or settled together with the principal
 *     (Bitway), one row each with the detail page's explanation behind an
 *     info icon and nothing to press;
 *   - the ledger's pending rewards, as their own fact cards, the way the
 *     Distributed stage shows them.
 * The header Rewards figure adds this list up with Claimable.
 */
export function RewardsPendingList({
  positionGroups,
  ledgerGroups,
  isLoading = false,
  emptyTitle,
  expansion,
}: {
  positionGroups: IEarnPositionRewardGroup[];
  ledgerGroups: IEarnRewardsPortfolioGroup[];
  /** the ledger part is still on its way: no empty state yet */
  isLoading?: boolean;
  emptyTitle: string;
  expansion: IGroupExpansion;
}) {
  const groups = useMemo(
    () => mergeRewardGroups({ positionGroups, ledgerGroups }),
    [positionGroups, ledgerGroups],
  );

  if (groups.length === 0) {
    if (isLoading) {
      return (
        <Stack ai="center" py="$8">
          <Spinner size="large" />
        </Stack>
      );
    }
    return <Empty illustration="BlockCoins" title={emptyTitle} />;
  }

  return (
    <YStack gap="$4">
      {groups.map((group) => (
        <GroupRow
          key={group.key}
          name={group.name}
          logoURI={group.logoURI}
          networkId={group.networkId}
          expanded={expansion.isExpanded(group.key)}
          onToggle={() => expansion.toggle(group.key)}
          total={<RewardsGroupTotal group={group} />}
        >
          {group.positionRows.length > 0 ? (
            <YStack
              px="$3"
              py="$1"
              borderRadius="$3"
              borderWidth="$px"
              borderColor="$borderSubdued"
              bg="$bg"
            >
              {group.positionRows.map((row) => (
                <ClaimableRewardRow
                  key={row.key}
                  networkId={row.position.source.networkId}
                  logoURI={row.asset.meta?.logoUrl}
                  title={
                    <NumberSizeableTextWrapper
                      hideValue
                      size="$bodyMdMedium"
                      formatter="balance"
                      formatterOptions={{ tokenSymbol: row.asset.symbol }}
                      numberOfLines={1}
                    >
                      {row.asset.amount}
                    </NumberSizeableTextWrapper>
                  }
                  subtitle={row.position.name}
                  fiatValue={
                    isProtocolAssetValueUnavailable(row.asset)
                      ? undefined
                      : row.asset.value
                  }
                  action={
                    row.asset.tooltip ? (
                      <EarnTooltip tooltip={row.asset.tooltip} />
                    ) : null
                  }
                />
              ))}
            </YStack>
          ) : null}
          {group.ledgerItems.map(({ group: ledgerGroup, item }, index) => (
            <LedgerRewardCard
              key={`${item.token.info.symbol}-${item.vault ?? ''}-${item.txHash ?? index}`}
              item={item}
              group={ledgerGroup}
            />
          ))}
        </GroupRow>
      ))}
    </YStack>
  );
}
