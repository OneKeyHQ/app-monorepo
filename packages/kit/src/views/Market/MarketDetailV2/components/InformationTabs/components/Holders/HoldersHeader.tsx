import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useHoldersLayout } from './useHoldersLayout';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function HoldersHeaderBase() {
  const intl = useIntl();
  const { layoutConfig } = useHoldersLayout();

  return (
    <XStack
      px="$4"
      py="$3"
      alignItems="center"
      gap="$3"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      backgroundColor="$bgApp"
    >
      <SizableText {...commonTextProps} {...layoutConfig.rank}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_holders_rank,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.address}>
        {intl.formatMessage({
          id: ETranslations.global_address,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.percentage}>
        %
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.amount}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_amount,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...layoutConfig.value}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_value,
        })}
      </SizableText>
    </XStack>
  );
}

const HoldersHeader = memo(HoldersHeaderBase);

export { HoldersHeader };
