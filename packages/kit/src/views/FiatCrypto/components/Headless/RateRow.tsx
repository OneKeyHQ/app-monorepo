import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  DetailEmptyValue,
  DetailRow,
  INFO_TRIGGER_HIT_SLOP,
  InfoPopoverContent,
  formatPrice,
} from './DetailRow';
import { getProviderDisplayName } from './ProviderLogo';

// "1 ETH ≈ $2,829.37" — the provider's conversion rate implied by the quote
// (getOnramperQuotePricing). One component for the review card and the order
// detail so both surfaces price the payout the same way. Without a price it
// shows a skeleton while a quote is in flight and "--" once none is coming.
export function RateRow({
  tokenSymbol,
  impliedPrice,
  providerName,
  isLoading,
}: {
  tokenSymbol: string;
  impliedPrice?: number;
  providerName?: string;
  isLoading?: boolean;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({
    id: ETranslations.swap_history_detail_rate,
  });
  // A priced quote always names its ramp; the generic word only covers an
  // order record saved without one.
  const providerLabel = providerName
    ? getProviderDisplayName(providerName)
    : intl.formatMessage({ id: ETranslations.swap_history_detail_provider });
  if (impliedPrice === undefined) {
    return (
      <DetailRow label={label}>
        {isLoading ? <Skeleton.BodyMd /> : <DetailEmptyValue />}
      </DetailRow>
    );
  }
  return (
    <DetailRow label={label}>
      <Popover
        title={label}
        renderTrigger={
          <XStack
            ai="center"
            gap="$1"
            cursor="pointer"
            role="button"
            hitSlop={INFO_TRIGGER_HIT_SLOP}
          >
            <SizableText size="$bodyMd">
              {`1 ${tokenSymbol} ≈ ${formatPrice(impliedPrice)}`}
            </SizableText>
            <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
          </XStack>
        }
        renderContent={
          <InfoPopoverContent>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.buy_rate_source__desc },
                { provider: providerLabel },
              )}
            </SizableText>
          </InfoPopoverContent>
        }
      />
    </DetailRow>
  );
}
