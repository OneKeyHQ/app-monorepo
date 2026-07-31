import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import type { IAggressiveLimitPriceWarning } from '../../../utils/aggressiveLimitPrice';

export function AggressiveLimitPriceWarning({
  warning,
}: {
  warning: IAggressiveLimitPriceWarning;
}) {
  const intl = useIntl();
  const percentage = intl.formatNumber(warning.deviationPercent, {
    style: 'decimal',
    maximumFractionDigits: 2,
  });
  const referencePrice = numberFormat(warning.referencePrice, {
    formatter: 'value',
    formatterOptions: { currency: '$' },
  });

  return (
    <XStack
      borderRadius="$3"
      backgroundColor="$bgCriticalSubdued"
      px="$3"
      py="$2.5"
      alignItems="flex-start"
      gap="$2"
    >
      <Icon
        name="InfoCircleOutline"
        size="$4"
        color="$iconCritical"
        flexShrink={0}
        mt="$0.5"
      />
      <SizableText size="$bodySm" color="$textCritical" flex={1}>
        {intl.formatMessage(
          {
            id:
              warning.side === 'long'
                ? ETranslations.perp_aggressive_limit_buy_price_warning__msg
                : ETranslations.perp_aggressive_limit_sell_warning__msg,
          },
          {
            percentage,
            referencePrice,
          },
        )}
      </SizableText>
    </XStack>
  );
}
