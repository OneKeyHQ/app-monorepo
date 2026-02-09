import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const commonTextProps = {
  size: '$bodySmMedium',
  color: '$textSubdued',
} as const;

function PortfolioHeaderNormalBase() {
  const intl = useIntl();

  return (
    <XStack
      py="$2"
      pl="$5"
      pr="$3"
      alignItems="center"
      backgroundColor="$bgApp"
    >
      <SizableText {...commonTextProps} width="50%">
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_amount,
        })}
      </SizableText>
      <SizableText {...commonTextProps}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_value,
        })}
      </SizableText>
    </XStack>
  );
}

const PortfolioHeaderNormal = memo(PortfolioHeaderNormalBase);

export { PortfolioHeaderNormal };
