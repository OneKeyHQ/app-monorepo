import { Divider, SizableText, Stack, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { useStockSecurityStats } from '../../hooks/useStockSecurityStats';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import { StockDescriptionRows } from '../StockDescriptionRows';
import { StockStatSections } from '../StockStatSections';

import { TokenOverviewSkeleton } from './TokenOverviewSkeleton';

export function StockTokenOverview() {
  const { tokenDetail, isStockToken } = useTokenDetail();
  const { assetAnalysisRows, tradingActivityRows, descriptionRows } =
    useStockSecurityStats(tokenDetail?.stock);

  if (!tokenDetail || !isStockToken) {
    return <TokenOverviewSkeleton />;
  }

  return (
    <Stack gap="$2" px="$5" pt="$5" pb="$3">
      <XStack alignItems="center" gap="$3" mb="$3">
        <Token size="lg" tokenImageUri={tokenDetail.logoUrl} />
        <Stack flex={1}>
          <SizableText size="$headingLg" color="$text" fontWeight="600">
            {tokenDetail.symbol}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {tokenDetail.name}
          </SizableText>
        </Stack>
      </XStack>

      <Stack pt="$3">
        <StockDescriptionRows rows={descriptionRows} />
      </Stack>

      <Divider my="$1" />

      <StockStatSections
        assetAnalysisRows={assetAnalysisRows}
        tradingActivityRows={tradingActivityRows}
      />
    </Stack>
  );
}
