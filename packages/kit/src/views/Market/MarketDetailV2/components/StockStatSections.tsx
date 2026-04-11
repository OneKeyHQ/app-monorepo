import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { StatCard } from './TokenOverview/components/StatCard';

import type { IStatItem } from './TokenOverview/components/StatCard';

export function StockStatSections({
  assetAnalysisRows,
  tradingActivityRows,
}: {
  assetAnalysisRows: IStatItem[][];
  tradingActivityRows: IStatItem[][];
}) {
  const intl = useIntl();

  return (
    <Stack gap="$4">
      <Stack gap="$2">
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({
            id: ETranslations.dexmarket_stock_asset_analysis,
          })}
        </SizableText>

        {assetAnalysisRows.map((row) => (
          <XStack key={row[0]?.label} gap="$2">
            {row.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </XStack>
        ))}
      </Stack>

      <Stack gap="$2">
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({
            id: ETranslations.dexmarket_stock_trading_activity,
          })}
        </SizableText>

        {tradingActivityRows.map((row) => (
          <XStack key={row[0]?.label} gap="$2">
            {row.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </XStack>
        ))}
      </Stack>
    </Stack>
  );
}
