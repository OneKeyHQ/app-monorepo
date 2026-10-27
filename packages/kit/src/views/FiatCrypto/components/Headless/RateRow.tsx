import {
  Icon,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { DetailRow, formatPrice } from './DetailRow';
import { getProviderDisplayName } from './ProviderLogo';

// "1 ETH ≈ $2,829.37" — the provider's conversion rate implied by the quote
// (getOnramperQuotePricing). One component for the review card and the
// success page so both surfaces price the payout the same way. Renders a
// skeleton while the price is unknown (quote in flight).
export function RateRow({
  tokenSymbol,
  impliedPrice,
  providerName,
  size = '$bodyMd',
  py,
  // The review card is still English-only pending its i18n pass; localized
  // surfaces (order detail) pass their own label so each page stays uniform.
  label = 'Rate',
}: {
  tokenSymbol: string;
  impliedPrice?: number;
  providerName?: string;
  size?: '$bodyMd' | '$bodyMdMedium';
  py?: '$2';
  label?: string;
}) {
  const providerLabel = providerName
    ? getProviderDisplayName(providerName)
    : 'the provider';
  return (
    <DetailRow label={label} py={py}>
      {impliedPrice === undefined ? (
        <Skeleton.BodyMd />
      ) : (
        <Popover
          title={label}
          renderTrigger={
            <XStack ai="center" gap="$1" cursor="pointer">
              <SizableText size={size}>
                {`1 ${tokenSymbol} ≈ ${formatPrice(impliedPrice)}`}
              </SizableText>
              <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
            </XStack>
          }
          renderContent={
            <YStack p="$5">
              <SizableText size="$bodyMd" color="$textSubdued">
                {`This rate is set by ${providerLabel} and already includes its spread. The estimated value of what you receive is based on this rate, not on the market price.`}
              </SizableText>
            </YStack>
          }
        />
      )}
    </DetailRow>
  );
}
