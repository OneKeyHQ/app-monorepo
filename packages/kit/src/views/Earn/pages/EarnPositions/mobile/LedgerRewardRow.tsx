import { useIntl } from 'react-intl';

import {
  Badge,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IEarnRewardsPortfolioGroup,
  IEarnRewardsPortfolioItem,
} from '@onekeyhq/shared/types/staking';

import { TransactionLink } from '../../EarnProtocolDetails/mobile/TransactionLink';

// The server speaks the full EBadgeColor set; 'danger' is the one value the
// Badge component does not have a variant for.
function toBadgeType(badgeType: string): IBadgeType {
  return badgeType === 'danger' ? 'critical' : (badgeType as IBadgeType);
}

/**
 * One ledger reward, in the detail page's row layout (product: "先按详情页
 * 的布局"): token, amount, then the fiat value with whichever of the stage's
 * facts the row carries — the expected payout date for pending, the arrival
 * date and transaction for distributed. The right side is the claim action
 * for claimable rows and the stage badge otherwise.
 */
export function LedgerRewardRow({
  item,
  group,
  action,
}: {
  item: IEarnRewardsPortfolioItem;
  group: IEarnRewardsPortfolioGroup;
  action?: React.ReactNode;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  let time: number | undefined;
  if (item.stage === 'pending') {
    time = item.availableAt;
  } else if (item.stage === 'distributed') {
    time = item.distributedAt;
  }
  const timeLabel = intl.formatMessage({
    id:
      item.stage === 'pending'
        ? ETranslations.earn_est_distribute_time__title
        : ETranslations.earn_distributed_time__title,
  });

  return (
    <XStack minHeight={40} ai="center" jc="space-between" gap="$3">
      <XStack ai="center" gap="$2.5" flex={1} minWidth={0}>
        <Token
          size="sm"
          tokenImageUri={item.token.info.logoURI}
          showNetworkIcon
          networkId={group.networkId}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <EarnText text={item.title} size="$bodyLgMedium" numberOfLines={1} />
          <XStack ai="center" gap="$1.5" flexWrap="wrap">
            {item.fiatValue ? (
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                formatter="value"
                formatterOptions={{ currency: currencyInfo.symbol }}
                numberOfLines={1}
              >
                {item.fiatValue}
              </NumberSizeableText>
            ) : null}
            {time ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {`${timeLabel} · ${formatDate(new Date(time), {
                  hideTimeForever: true,
                })}`}
              </SizableText>
            ) : null}
            {item.txHash ? (
              <TransactionLink
                networkId={group.networkId}
                txHash={item.txHash}
              />
            ) : null}
          </XStack>
        </YStack>
      </XStack>
      <XStack ai="center" gap="$2" flexShrink={0}>
        {action}
        {!action && item.badge ? (
          <Badge badgeType={toBadgeType(item.badge.badgeType)}>
            <Badge.Text>{item.badge.text.text}</Badge.Text>
          </Badge>
        ) : null}
      </XStack>
    </XStack>
  );
}
