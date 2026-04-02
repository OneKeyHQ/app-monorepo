import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function PortfolioHeaderSmallBase() {
  const intl = useIntl();

  return (
    <XStack px="$5" py="$2" alignItems="center">
      <SizableText {...commonTextProps} w={100} minWidth={0}>
        {intl.formatMessage({ id: ETranslations.global_balance })}
      </SizableText>
      <SizableText {...commonTextProps} flex={1} textAlign="right">
        {intl.formatMessage({ id: ETranslations.marketdex_unrealized_pnl })}
      </SizableText>
      <SizableText {...commonTextProps} w={110} textAlign="right">
        {intl.formatMessage({ id: ETranslations.marketdex_total_pnl })}
      </SizableText>
    </XStack>
  );
}

const PortfolioHeaderSmall = memo(PortfolioHeaderSmallBase);

export { PortfolioHeaderSmall };
