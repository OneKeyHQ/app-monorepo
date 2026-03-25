import { SizableText, XStack, YStack } from '@onekeyhq/components';

import { useStockSecurityStats } from '../../hooks/useStockSecurityStats';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import { StockDescriptionRows } from '../StockDescriptionRows';
import { StatCard } from '../TokenOverview/components/StatCard';

export function StockTradingActivity() {
  const { tokenDetail, isStockToken } = useTokenDetail();
  const { statRows, descriptionRows } = useStockSecurityStats(
    tokenDetail?.stock,
  );

  if (!isStockToken) {
    return null;
  }

  return (
    <YStack px="$3" pt="$3" gap="$3">
      <SizableText size="$bodyLgMedium">Trading Activity</SizableText>

      <YStack gap="$2">
        {statRows.map((row) => (
          <XStack key={row[0]?.label} gap="$2">
            {row.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </XStack>
        ))}
      </YStack>

      <StockDescriptionRows rows={descriptionRows} />
    </YStack>
  );
}
