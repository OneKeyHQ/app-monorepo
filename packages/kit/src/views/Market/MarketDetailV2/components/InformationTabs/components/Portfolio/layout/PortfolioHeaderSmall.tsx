import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function PortfolioHeaderSmallBase() {
  const intl = useIntl();

  return (
    <XStack px="$4" py="$3" alignItems="center">
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

const PortfolioHeaderSmall = memo(PortfolioHeaderSmallBase);

export { PortfolioHeaderSmall };
