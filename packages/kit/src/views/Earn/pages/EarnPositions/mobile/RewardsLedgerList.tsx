import BigNumber from 'bignumber.js';

import { NumberSizeableText, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import type { IEarnRewardsPortfolioGroup } from '@onekeyhq/shared/types/staking';

import { GroupRow } from './GroupRow';
import { LedgerRewardCard } from './LedgerRewardCard';
import { LedgerRewardRow } from './LedgerRewardRow';

import type { IGroupExpansion } from './GroupRow';

/**
 * The group's fiat total, the way the protocol rows read; the token amount
 * only when nothing priced the group (QA: one figure style for every row).
 */
function LedgerGroupTotal({ group }: { group: IEarnRewardsPortfolioGroup }) {
  const currencyInfo = useCurrency();
  const hasFiat = new BigNumber(group.total.fiatValue || '0').gt(0);
  if (!hasFiat && group.total.amount && group.total.symbol) {
    return (
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="balance"
        formatterOptions={{ tokenSymbol: group.total.symbol }}
        numberOfLines={1}
      >
        {group.total.amount}
      </NumberSizeableText>
    );
  }
  return (
    <NumberSizeableText
      size="$bodyLgMedium"
      formatter="value"
      formatterOptions={{ currency: currencyInfo.symbol }}
      numberOfLines={1}
    >
      {group.total.fiatValue}
    </NumberSizeableText>
  );
}

/**
 * Ledger groups, one collapsible row per protocol on one network. Pending and
 * distributed rows render as the design's fact cards; claimable rows keep the
 * detail page's row layout with the inline Claim action (product asked for
 * the detail page's layout here).
 */
export function RewardsLedgerList({
  groups,
  expansion,
  renderAction,
}: {
  groups: IEarnRewardsPortfolioGroup[];
  expansion: IGroupExpansion;
  renderAction?: (
    group: IEarnRewardsPortfolioGroup,
    item: IEarnRewardsPortfolioGroup['items'][number],
  ) => React.ReactNode;
}) {
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
          {group.items.map((item, itemIndex) => {
            const key = `${item.token.info.symbol}-${item.vault ?? ''}-${item.txHash ?? itemIndex}`;
            if (item.stage === 'claimable') {
              return (
                <YStack
                  key={key}
                  p="$3"
                  borderRadius="$3"
                  borderWidth="$px"
                  borderColor="$borderSubdued"
                  bg="$bg"
                >
                  <LedgerRewardRow
                    item={item}
                    group={group}
                    action={renderAction?.(group, item)}
                  />
                </YStack>
              );
            }
            return <LedgerRewardCard key={key} item={item} group={group} />;
          })}
        </GroupRow>
      ))}
    </YStack>
  );
}
