import { NumberSizeableText, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import type { IEarnRewardsPortfolioGroup } from '@onekeyhq/shared/types/staking';

import { GroupRow } from './GroupRow';
import { LedgerRewardCard } from './LedgerRewardCard';
import { LedgerRewardRow } from './LedgerRewardRow';

import type { IGroupExpansion } from './GroupRow';

/** "123 USDC" when the group is one token, otherwise its fiat total. */
function LedgerGroupTotal({ group }: { group: IEarnRewardsPortfolioGroup }) {
  const currencyInfo = useCurrency();
  if (group.total.amount && group.total.symbol) {
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
  indexOffset = 0,
  renderAction,
}: {
  groups: IEarnRewardsPortfolioGroup[];
  expansion: IGroupExpansion;
  /** how many groups precede this list, so only one first group opens */
  indexOffset?: number;
  renderAction?: (
    group: IEarnRewardsPortfolioGroup,
    item: IEarnRewardsPortfolioGroup['items'][number],
  ) => React.ReactNode;
}) {
  return (
    <YStack gap="$4">
      {groups.map((group, index) => (
        <GroupRow
          key={`${group.provider}|${group.networkId}`}
          name={group.providerName}
          logoURI={group.providerLogoURI}
          networkId={group.networkId}
          expanded={expansion.isExpanded(
            `${group.provider}|${group.networkId}`,
            indexOffset + index,
          )}
          onToggle={() =>
            expansion.toggle(
              `${group.provider}|${group.networkId}`,
              indexOffset + index,
            )
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
