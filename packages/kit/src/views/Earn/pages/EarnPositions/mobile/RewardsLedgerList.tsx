import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IEarnRewardsPortfolioGroup } from '@onekeyhq/shared/types/staking';

import { LedgerRewardRow } from './LedgerRewardRow';

/** Protocol header of a ledger group: logo, name, and the group's figure. */
export function LedgerGroupHeader({
  group,
}: {
  group: IEarnRewardsPortfolioGroup;
}) {
  const currencyInfo = useCurrency();
  return (
    <XStack ai="center" jc="space-between" gap="$3" minHeight={40}>
      <XStack ai="center" gap="$2" flex={1} minWidth={0}>
        <Token
          size="sm"
          borderRadius="$2"
          tokenImageUri={group.providerLogoURI}
          showNetworkIcon
          networkId={group.networkId}
        />
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {group.providerName}
        </SizableText>
      </XStack>
      {/* "123 USDC" when the group is one token, otherwise the fiat total */}
      {group.total.amount && group.total.symbol ? (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="balance"
          formatterOptions={{ tokenSymbol: group.total.symbol }}
          numberOfLines={1}
        >
          {group.total.amount}
        </NumberSizeableText>
      ) : (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: currencyInfo.symbol }}
          numberOfLines={1}
        >
          {group.total.fiatValue}
        </NumberSizeableText>
      )}
    </XStack>
  );
}

/** Pending / Distributed: ledger groups, one card per protocol. */
export function RewardsLedgerList({
  groups,
  renderAction,
}: {
  groups: IEarnRewardsPortfolioGroup[];
  renderAction?: (
    group: IEarnRewardsPortfolioGroup,
    item: IEarnRewardsPortfolioGroup['items'][number],
  ) => React.ReactNode;
}) {
  return (
    <YStack px="$5" gap="$4">
      {groups.map((group) => (
        <YStack
          key={`${group.provider}|${group.networkId}`}
          gap="$2"
          p="$3"
          borderRadius="$3"
          borderWidth="$px"
          borderColor="$borderSubdued"
          bg="$bg"
        >
          <LedgerGroupHeader group={group} />
          {group.items.map((item, index) => (
            <LedgerRewardRow
              key={`${item.token.info.symbol}-${item.vault ?? ''}-${item.txHash ?? index}`}
              item={item}
              group={group}
              action={renderAction?.(group, item)}
            />
          ))}
        </YStack>
      ))}
    </YStack>
  );
}
