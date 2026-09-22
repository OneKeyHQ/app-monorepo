import { useState } from 'react';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { PendingIndicator } from '@onekeyhq/kit/src/views/Staking/components/StakingActivityIndicator';
import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import { EarnTestIDs } from '../../../testIDs';

import { PositionCard } from './PositionCard';

import type { IProtocolGroup } from './myPortfolio.utils';

/**
 * One provider on the DeFi Assets tab: a collapsible row (logo, name, fiat
 * total, in-flight badge) that opens into one PositionCard per vault.
 */
export function ProtocolGroupRow({
  group,
  pendingCount = 0,
  defaultExpanded = false,
  onManage,
}: {
  group: IProtocolGroup;
  pendingCount?: number;
  defaultExpanded?: boolean;
  onManage?: (investment: IEarnPortfolioInvestment) => void;
}) {
  const currencyInfo = useCurrency();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <YStack gap="$3">
      <XStack
        ai="center"
        jc="space-between"
        gap="$3"
        minHeight={44}
        px="$5"
        cursor="pointer"
        userSelect="none"
        onPress={() => setExpanded((value) => !value)}
        testID={EarnTestIDs.portfolioItem(group.providerName)}
      >
        <XStack ai="center" gap="$2" flex={1} minWidth={0}>
          <Token
            size="sm"
            borderRadius="$2"
            tokenImageUri={group.providerLogoURI}
          />
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {group.providerName}
          </SizableText>
          {pendingCount > 0 ? <PendingIndicator num={pendingCount} /> : null}
        </XStack>
        <XStack ai="center" gap="$2" flexShrink={0}>
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
            numberOfLines={1}
          >
            {group.totalFiatValue}
          </NumberSizeableText>
          <Icon
            name={
              expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>
      {expanded ? (
        <YStack px="$5" gap="$3">
          {group.investments.map((investment) => (
            <PositionCard
              key={`${investment.protocol.providerDetail.code}-${investment.protocol.symbol ?? ''}-${investment.protocol.vault ?? ''}-${investment.network.networkId}`}
              investment={investment}
              onManage={onManage}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
