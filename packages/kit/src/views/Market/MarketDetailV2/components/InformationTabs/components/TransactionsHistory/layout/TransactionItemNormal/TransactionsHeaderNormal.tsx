import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTransactionsLayoutNormal } from './useTransactionsLayoutNormal';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function TransactionsHeaderNormalBase() {
  const intl = useIntl();
  const { styles } = useTransactionsLayoutNormal();

  return (
    <XStack
      width="100%"
      px="$4"
      py="$3"
      alignItems="center"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      backgroundColor="$bgApp"
    >
      <SizableText {...commonTextProps} {...styles.time}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_time,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...styles.type}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_type,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...styles.amount}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_amount,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...styles.price}>
        {intl.formatMessage({
          id: ETranslations.global_price,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...styles.value}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_value,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...styles.address}>
        {intl.formatMessage({
          id: ETranslations.global_address,
        })}
      </SizableText>
    </XStack>
  );
}

const TransactionsHeaderNormal = memo(TransactionsHeaderNormalBase);

export { TransactionsHeaderNormal };
