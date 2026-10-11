import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import type { ColorTokens, ISizableTextProps } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { REFERRAL_USD_CURRENCY_PROPS } from './shared/getRewardSummary';
import { ReferralUsdUnit } from './shared/ReferralUsdUnit';

import type { IRewardSummary } from './shared/getRewardSummary';

// Reward amounts are always shown in USD, like the earnings card, so the
// product figures add up to its unpaid total on every layout. Prefers the USD
// total; otherwise converts the wallet-currency value back to USD.
export function InviteRewardAmount({
  summary,
  size = '$bodyMdMedium',
  color,
  emptyLabel = false,
  withUnit = false,
}: {
  summary: IRewardSummary;
  size?: ISizableTextProps['size'];
  color?: ColorTokens;
  // Show "No reward yet" instead of a zero amount.
  emptyLabel?: boolean;
  // Append the "USD" unit, for layouts without a column header to carry it.
  withUnit?: boolean;
}) {
  const intl = useIntl();

  if (!summary.hasReward && emptyLabel) {
    // A note rather than a figure, so it takes the regular weight of the
    // page's other subdued text.
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.referral_no_reward })}
      </SizableText>
    );
  }

  const hasUsd = summary.usdValue !== undefined;
  const amount = (
    <Currency
      size={size}
      color={color}
      formatter="value"
      numberOfLines={1}
      {...(hasUsd
        ? REFERRAL_USD_CURRENCY_PROPS
        : { targetCurrency: REFERRAL_USD_CURRENCY_PROPS.targetCurrency })}
    >
      {hasUsd ? summary.usdValue : summary.fiatValue}
    </Currency>
  );
  if (!withUnit) {
    return amount;
  }
  return (
    <XStack ai="baseline" gap="$1">
      {amount}
      <ReferralUsdUnit size={size === '$bodySm' ? '$bodySm' : '$bodyMd'} />
    </XStack>
  );
}
