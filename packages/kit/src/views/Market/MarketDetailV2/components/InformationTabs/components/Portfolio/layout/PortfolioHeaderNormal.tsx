import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const commonTextProps = {
  size: '$bodySmMedium',
  color: '$textSubdued',
} as const;

function PortfolioHeaderNormalBase() {
  const intl = useIntl();
  const { gtXl } = useMedia();
  const columnWidth = gtXl ? 240 : 130;

  return (
    <XStack
      py="$2"
      px="$5"
      alignItems="center"
      backgroundColor="$bgApp"
      gap="$6"
    >
      <SizableText {...commonTextProps} w={100}>
        Token
      </SizableText>
      <SizableText {...commonTextProps} w={columnWidth} textAlign="right">
        {intl.formatMessage({ id: ETranslations.global_balance })}
      </SizableText>
      <SizableText {...commonTextProps} w={columnWidth} textAlign="right">
        {intl.formatMessage({ id: ETranslations.marketdex_unrealized_pnl })}
      </SizableText>
      <SizableText {...commonTextProps} w={columnWidth} textAlign="right">
        {intl.formatMessage({ id: ETranslations.marketdex_total_pnl })}
      </SizableText>
    </XStack>
  );
}

const PortfolioHeaderNormal = memo(PortfolioHeaderNormalBase);

export { PortfolioHeaderNormal };
