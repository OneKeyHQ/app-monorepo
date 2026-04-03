import { memo } from 'react';

import { useIntl } from 'react-intl';

import { DashText, SizableText, XStack, useMedia } from '@onekeyhq/components';
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
        {intl.formatMessage({ id: ETranslations.perp_relay_token__title })}
      </SizableText>
      <SizableText {...commonTextProps} w={columnWidth} textAlign="right">
        {intl.formatMessage({ id: ETranslations.global_balance })}
      </SizableText>
      <XStack w={columnWidth} justifyContent="flex-end">
        <DashText
          size="$bodySmMedium"
          color="$textSubdued"
          dashColor="$textDisabled"
          dashThickness={0.5}
          tooltip={intl.formatMessage({ id: ETranslations.marketdex_un_pnl })}
          tooltipTitle={intl.formatMessage({
            id: ETranslations.marketdex_pnl_cal,
          })}
        >
          {intl.formatMessage({
            id: ETranslations.marketdex_unrealized_pnl,
          })}
        </DashText>
      </XStack>
      <XStack w={columnWidth} justifyContent="flex-end">
        <DashText
          size="$bodySmMedium"
          color="$textSubdued"
          dashColor="$textDisabled"
          dashThickness={0.5}
          tooltip={intl.formatMessage({
            id: ETranslations.marketdex_total_pnl_desc,
          })}
          tooltipTitle={intl.formatMessage({
            id: ETranslations.marketdex_pnl_cal,
          })}
        >
          {intl.formatMessage({
            id: ETranslations.marketdex_total_pnl,
          })}
        </DashText>
      </XStack>
    </XStack>
  );
}

const PortfolioHeaderNormal = memo(PortfolioHeaderNormalBase);

export { PortfolioHeaderNormal };
