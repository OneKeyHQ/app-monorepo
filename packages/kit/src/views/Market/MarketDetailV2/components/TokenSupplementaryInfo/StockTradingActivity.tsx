import { Divider, YStack } from '@onekeyhq/components';

import { useStockSecurityStats } from '../../hooks/useStockSecurityStats';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import { StockDescriptionRows } from '../StockDescriptionRows';
import { StockStatSections } from '../StockStatSections';

export function StockTradingActivity() {
  const { tokenDetail, isStockToken } = useTokenDetail();
  const { assetAnalysisRows, tradingActivityRows, descriptionRows } =
    useStockSecurityStats(tokenDetail?.stock);

  if (!tokenDetail || !isStockToken) {
    return null;
  }

  return (
    <YStack px="$3" pt="$3" gap="$3">
      <StockDescriptionRows rows={descriptionRows} />

      <Divider my="$1" />

      <StockStatSections
        assetAnalysisRows={assetAnalysisRows}
        tradingActivityRows={tradingActivityRows}
      />
    </YStack>
  );
}
