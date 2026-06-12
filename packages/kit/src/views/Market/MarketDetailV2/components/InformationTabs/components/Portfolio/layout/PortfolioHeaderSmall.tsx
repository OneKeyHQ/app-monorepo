import { memo } from 'react';

import { useIntl } from 'react-intl';

import { DashText, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function PortfolioHeaderSmallBase() {
  const intl = useIntl();

  return (
    <XStack px="$5" py="$2" alignItems="center">
      <SizableText {...commonTextProps} w={100} minWidth={0}>
        {intl.formatMessage({ id: ETranslations.global_balance })}
      </SizableText>
      <XStack flex={1} justifyContent="flex-end">
        <DashText
          size="$bodySm"
          color="$textSubdued"
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
      <XStack w={110} justifyContent="flex-end">
        <DashText
          size="$bodySm"
          color="$textSubdued"
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

const PortfolioHeaderSmall = memo(PortfolioHeaderSmallBase);

export { PortfolioHeaderSmall };
