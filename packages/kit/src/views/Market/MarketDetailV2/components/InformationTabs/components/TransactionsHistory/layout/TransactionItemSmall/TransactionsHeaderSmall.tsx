import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTransactionsLayoutSmall } from './useTransactionsLayoutSmall';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function TransactionsHeaderSmallBase() {
  const intl = useIntl();
  const { styles } = useTransactionsLayoutSmall();

  return (
    <XStack
      px="$5"
      pt="$3"
      pb="$1"
      alignItems="center"
      backgroundColor="$bgApp"
    >
      <YStack>
        <SizableText {...commonTextProps} {...styles.time}>
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_history_type,
          })}
          {' / '}
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_history_time,
          })}
        </SizableText>
      </YStack>

      <SizableText {...commonTextProps} {...styles.amount}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_amount,
        })}
      </SizableText>

      <SizableText {...commonTextProps} {...styles.price}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_value,
        })}
        {' / '}
        {intl.formatMessage({
          id: ETranslations.global_price,
        })}
      </SizableText>
    </XStack>
  );
}

const TransactionsHeaderSmall = memo(TransactionsHeaderSmallBase);

export { TransactionsHeaderSmall };
