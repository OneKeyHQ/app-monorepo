import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTransactionsLayout } from './useTransactionsLayout';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function TransactionsHeaderBase() {
  const intl = useIntl();
  const { layoutConfig } = useTransactionsLayout();

  return (
    <XStack
      px="$4"
      py="$3"
      alignItems="center"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      backgroundColor="$bgApp"
    >
      <SizableText {...commonTextProps} {...layoutConfig.time}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_time,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.type}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_type,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.amount}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_amount,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.price}>
        {intl.formatMessage({
          id: ETranslations.global_price,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.value}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_value,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.address}>
        {intl.formatMessage({
          id: ETranslations.global_address,
        })}
      </SizableText>
    </XStack>
  );
}

const TransactionsHeader = memo(TransactionsHeaderBase);

export { TransactionsHeader };
