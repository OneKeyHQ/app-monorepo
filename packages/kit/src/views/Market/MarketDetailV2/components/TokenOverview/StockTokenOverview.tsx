import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useStockDetail } from '../../hooks/StockDetailContext';
import { useStockSecurityStats } from '../../hooks/useStockSecurityStats';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  STOCK_ABOUT_IPO_DATE_LABEL,
  buildStockInfoFromPublicDetail,
  formatDirectPercentValue,
  getStockAnalystConsensus,
} from '../../utils/stockPublicDataUtils';
import { StockDescriptionRows } from '../StockDescriptionRows';
import { StockStatSections } from '../StockStatSections';

import { TokenOverviewSkeleton } from './TokenOverviewSkeleton';

export function StockTokenOverview() {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const { tokenDetail, isStockToken } = useTokenDetail();
  const { stockDetail, isStockDetailError, retryStockDetail } =
    useStockDetail();
  const stock = stockDetail
    ? buildStockInfoFromPublicDetail(stockDetail, tokenDetail?.stock)
    : tokenDetail?.stock;
  const { assetAnalysisRows, tradingActivityRows, descriptionRows } =
    useStockSecurityStats(stock);

  if ((!tokenDetail && !stockDetail) || !isStockToken) {
    return <TokenOverviewSkeleton />;
  }

  if (isStockDetailError) {
    return (
      <YStack
        minHeight={240}
        alignItems="center"
        justifyContent="center"
        gap="$2"
      >
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          })}
        </SizableText>
        <Button
          testID="stock-token-overview-retry"
          size="small"
          variant="tertiary"
          onPress={() => void retryStockDetail()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  }

  const ratings = stockDetail?.analystRatings;
  const about = stockDetail?.about;

  return (
    <Stack gap="$2" px="$5" pt="$5" pb="$3">
      <XStack alignItems="center" gap="$3" mb="$3">
        <Token
          size="lg"
          tokenImageUri={stockDetail?.logoUrl ?? tokenDetail?.logoUrl}
        />
        <Stack flex={1}>
          <SizableText size="$headingLg" color="$text" fontWeight="600">
            {stockDetail?.symbol ?? tokenDetail?.symbol}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {stockDetail?.name ?? tokenDetail?.name}
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

      <Divider my="$1" />

      <Stack gap="$3" py="$2">
        <SizableText size="$bodyLgMedium">Analyst Ratings</SizableText>
        <XStack justifyContent="space-between">
          <SizableText color="$textSubdued">Consensus</SizableText>
          <SizableText>{getStockAnalystConsensus(ratings)}</SizableText>
        </XStack>
        {[
          { label: 'Buy', value: ratings?.buy },
          { label: 'Hold', value: ratings?.hold },
          { label: 'Sell', value: ratings?.sell },
        ].map((item) => (
          <XStack key={item.label} justifyContent="space-between">
            <SizableText color="$textSubdued">{item.label}</SizableText>
            <SizableText>{formatDirectPercentValue(item.value)}</SizableText>
          </XStack>
        ))}
      </Stack>

      <Divider my="$1" />

      <Stack gap="$3" py="$2">
        <SizableText size="$bodyLgMedium">
          About {stockDetail?.symbol ?? tokenDetail?.symbol}
        </SizableText>
        {[
          { label: 'CEO', value: about?.ceo },
          { label: 'Employees', value: about?.employees },
          { label: 'Exchange', value: about?.exchange },
          {
            label: STOCK_ABOUT_IPO_DATE_LABEL,
            value: about?.ipoDate
              ? formatDate(about.ipoDate, { hideTimeForever: true })
              : '--',
          },
        ].map((item) => (
          <XStack key={item.label} justifyContent="space-between" gap="$4">
            <SizableText color="$textSubdued">{item.label}</SizableText>
            <SizableText numberOfLines={1}>{item.value ?? '--'}</SizableText>
          </XStack>
        ))}
        {about?.description ? (
          <SizableText color="$textSubdued">{about.description}</SizableText>
        ) : null}
      </Stack>
    </Stack>
  );
}
