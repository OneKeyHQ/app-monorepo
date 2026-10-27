import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { ColorTokens, ISizableTextProps } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { REFERRAL_USD_SOURCE_PROPS } from './shared/getRewardSummary';

import type { IRewardSummary } from './shared/getRewardSummary';

// Reward amounts are shown in the wallet currency, like the earnings card, so
// the product figures add up to its unpaid total on every layout. Prefers the
// USD total, converted; otherwise the wallet-currency value as is.
export function InviteRewardAmount({
  summary,
  size = '$bodyMdMedium',
  color,
  emptyLabel = false,
}: {
  summary: IRewardSummary;
  size?: ISizableTextProps['size'];
  color?: ColorTokens;
  // Show "No reward yet" instead of a zero amount.
  emptyLabel?: boolean;
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
  return (
    <Currency
      size={size}
      color={color}
      formatter="value"
      numberOfLines={1}
      // `fiatValue` already arrives in the wallet currency.
      {...(hasUsd ? REFERRAL_USD_SOURCE_PROPS : {})}
    >
      {hasUsd ? summary.usdValue : summary.fiatValue}
    </Currency>
  );
}
