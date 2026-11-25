import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import type { IEarnRewardsPortfolioGroup } from '@onekeyhq/shared/types/staking';

import { GroupRow } from './GroupRow';
import {
  LedgerRewardCard,
  LedgerRewardTableHeader,
  ledgerRewardTableColumns,
  ledgerTimeOf,
} from './LedgerRewardCard';
import { usePortfolioTableLayout } from './portfolioTableLayout';

import type { IGroupExpansion } from './GroupRow';

/**
 * The group's fiat total, the way the protocol rows read; the token amount
 * only when nothing priced the group (QA: one figure style for every row).
 */
function LedgerGroupTotal({ group }: { group: IEarnRewardsPortfolioGroup }) {
  const currencyInfo = useCurrency();
  // The wide layout's card header reads its figure at the name's size
  const size = usePortfolioTableLayout() ? '$headingLg' : '$bodyLgMedium';
  const hasFiat = new BigNumber(group.total.fiatValue || '0').gt(0);
  if (!hasFiat && group.total.amount && group.total.symbol) {
    return (
      <NumberSizeableTextWrapper
        hideValue
        size={size}
        formatter="balance"
        formatterOptions={{ tokenSymbol: group.total.symbol }}
        numberOfLines={1}
      >
        {group.total.amount}
      </NumberSizeableTextWrapper>
    );
  }
  return (
    <NumberSizeableTextWrapper
      hideValue
      size={size}
      formatter="value"
      formatterOptions={{ currency: currencyInfo.symbol }}
      numberOfLines={1}
    >
      {group.total.fiatValue}
    </NumberSizeableTextWrapper>
  );
}

/**
 * Ledger groups of the Pending and Distributed stages, one collapsible row
 * per protocol on one network, each reward as the design's fact card.
 * Claimable ledger rewards sit in RewardsClaimableList, one row each with
 * their Claim, together with the positions' rewards.
 */
export function RewardsLedgerList({
  groups,
  expansion,
}: {
  groups: IEarnRewardsPortfolioGroup[];
  expansion: IGroupExpansion;
}) {
  const isTableLayout = usePortfolioTableLayout();
  return (
    <YStack gap="$4">
      {groups.map((group) => (
        <GroupRow
          key={`${group.provider}|${group.networkId}`}
          name={group.providerName}
          logoURI={group.providerLogoURI}
          networkId={group.networkId}
          expanded={expansion.isExpanded(
            `${group.provider}|${group.networkId}`,
          )}
          onToggle={() =>
            expansion.toggle(`${group.provider}|${group.networkId}`)
          }
          total={<LedgerGroupTotal group={group} />}
        >
          {isTableLayout && group.items[0] ? (
            <YStack>
              <LedgerRewardTableHeader
                stage={group.items[0].stage}
                hasTime={group.items.some((item) =>
                  Boolean(ledgerTimeOf(item)),
                )}
                columns={ledgerRewardTableColumns(group.items)}
              />
              {group.items.map((item, itemIndex) => (
                <LedgerRewardCard
                  key={`${item.token.info.symbol}-${item.vault ?? ''}-${item.txHash ?? itemIndex}`}
                  item={item}
                  group={group}
                  columns={ledgerRewardTableColumns(group.items)}
                />
              ))}
            </YStack>
          ) : (
            group.items.map((item, itemIndex) => (
              <LedgerRewardCard
                key={`${item.token.info.symbol}-${item.vault ?? ''}-${item.txHash ?? itemIndex}`}
                item={item}
                group={group}
              />
            ))
          )}
        </GroupRow>
      ))}
    </YStack>
  );
}
