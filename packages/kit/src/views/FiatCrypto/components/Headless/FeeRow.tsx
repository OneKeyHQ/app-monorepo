import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  DetailEmptyValue,
  DetailRow,
  INFO_TRIGGER_HIT_SLOP,
  formatPrice,
} from './DetailRow';

// "Fee  $3.37 ⓘ" — the quote's fees in total, itemized in a popover. One
// component for the review card and the order detail: the receipt explains
// the gap between what was paid and what arrived the same way the review did.
// Without fees it shows a skeleton while a quote is in flight and "--" once
// none is coming.
export function FeeRow({
  networkFee,
  transactionFee,
  isLoading,
}: {
  networkFee?: number;
  transactionFee?: number;
  isLoading?: boolean;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: ETranslations.fee_fee });
  if (networkFee === undefined && transactionFee === undefined) {
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
            <NumberSizeableText
              size="$bodyMd"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {(networkFee ?? 0) + (transactionFee ?? 0)}
            </NumberSizeableText>
            <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
          </XStack>
        }
        renderContent={
          // The two rows are the explanation: a sentence naming the same two
          // fees above them would only repeat them.
          <YStack p="$5" gap="$3">
            {networkFee !== undefined ? (
              <XStack jc="space-between" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.swap_history_detail_network_fee,
                  })}
                </SizableText>
                <SizableText size="$bodyMd">
                  {formatPrice(networkFee)}
                </SizableText>
              </XStack>
            ) : null}
            {transactionFee !== undefined ? (
              <XStack jc="space-between" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.buy_transaction_fee__title,
                  })}
                </SizableText>
                <SizableText size="$bodyMd">
                  {formatPrice(transactionFee)}
                </SizableText>
              </XStack>
            ) : null}
          </YStack>
        }
      />
    </DetailRow>
  );
}
