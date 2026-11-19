import { useMemo } from 'react';

import { Empty, Spinner, Stack, YStack } from '@onekeyhq/components';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import type { IEarnRewardsPortfolioGroup } from '@onekeyhq/shared/types/staking';

import {
  ClaimableRewardRow,
  RewardTableHeader,
  rewardTableColumns,
} from './ClaimableRewardRow';
import { GroupRow } from './GroupRow';
import {
  LedgerRewardCard,
  LedgerRewardTableHeader,
  ledgerRewardTableColumns,
  ledgerTimeOf,
} from './LedgerRewardCard';
import { mergeRewardGroups } from './myPortfolio.utils';
import { usePortfolioTableLayout } from './portfolioTableLayout';
import {
  REWARD_ROWS_BOX_PROPS,
  RewardsGroupTotal,
} from './RewardsClaimableList';

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
  const isTableLayout = usePortfolioTableLayout();
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
      {groups.map((group) => {
        // A reward's explanation sits where a row's action goes
        const columns = isTableLayout
          ? rewardTableColumns(
              group.positionRows.some((row) => Boolean(row.asset.tooltip)),
            )
          : undefined;
        const ledgerColumns = isTableLayout
          ? ledgerRewardTableColumns(group.ledgerItems.map(({ item }) => item))
          : undefined;
        return (
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
              <YStack {...(isTableLayout ? {} : REWARD_ROWS_BOX_PROPS)}>
                {columns ? <RewardTableHeader columns={columns} /> : null}
                {group.positionRows.map((row) => (
                  <ClaimableRewardRow
                    key={row.key}
                    columns={columns}
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
            {ledgerColumns && group.ledgerItems.length > 0 ? (
              <YStack>
                <LedgerRewardTableHeader
                  stage="pending"
                  hasTime={group.ledgerItems.some(({ item }) =>
                    Boolean(ledgerTimeOf(item)),
                  )}
                  columns={ledgerColumns}
                />
                {group.ledgerItems.map(
                  ({ group: ledgerGroup, item }, index) => (
                    <LedgerRewardCard
                      key={`${item.token.info.symbol}-${item.vault ?? ''}-${item.txHash ?? index}`}
                      item={item}
                      group={ledgerGroup}
                      columns={ledgerColumns}
                    />
                  ),
                )}
              </YStack>
            ) : (
              group.ledgerItems.map(({ group: ledgerGroup, item }, index) => (
                <LedgerRewardCard
                  key={`${item.token.info.symbol}-${item.vault ?? ''}-${item.txHash ?? index}`}
                  item={item}
                  group={ledgerGroup}
                />
              ))
            )}
          </GroupRow>
        );
      })}
    </YStack>
  );
}
