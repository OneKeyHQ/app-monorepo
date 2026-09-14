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
import { buildStockInfoFromPublicDetail } from '../../utils/stockPublicDataUtils';
import { MarketAboutDescription } from '../MarketAboutDescription';
import { StockDescriptionRows } from '../StockDescriptionRows';
import { StockFinancials } from '../StockFinancials/StockFinancials';
import { StockStatSections } from '../StockStatSections';

import { TokenOverviewSkeleton } from './TokenOverviewSkeleton';

// MarketAboutDescription collapses to two lines, about 200 Latin characters at
// the desktop width. The ~335px mobile column needs four to show a similar
// amount.
const STOCK_OVERVIEW_ABOUT_COLLAPSED_LINES = 4;

export function StockTokenOverview() {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const { tokenDetail, isStockToken } = useTokenDetail();
  const { stockId, stockDetail, isStockDetailError, retryStockDetail } =
    useStockDetail();
  const stock = stockDetail
    ? buildStockInfoFromPublicDetail(stockDetail, tokenDetail?.stock)
    : tokenDetail?.stock;
  const { assetAnalysisRows, tradingActivityRows, descriptionRows } =
    useStockSecurityStats(stock);

  if (isStockDetailError && !stock) {
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

  if ((!tokenDetail && !stockDetail) || !isStockToken) {
    return <TokenOverviewSkeleton />;
  }

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

      {stockId ? (
        <StockFinancials stockId={stockId} withHorizontalPadding={false} />
      ) : null}

      <Stack gap="$3" py="$2">
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage(
            { id: ETranslations.market_about_title },
            { ticker: stockDetail?.symbol ?? tokenDetail?.symbol },
          )}
        </SizableText>
        {[
          {
            label: intl.formatMessage({
              id: ETranslations.market_stock_about_ceo,
            }),
            value: about?.ceo,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.market_stock_about_employees,
            }),
            value: about?.employees,
          },
          {
            label: intl.formatMessage({ id: ETranslations.exchange__title }),
            value: about?.exchange,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.market_stock_about_ipo_date,
            }),
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
          <MarketAboutDescription
            description={about.description}
            testID="stock-overview-about-description"
            toggleTestID="stock-overview-about-description-toggle"
            collapsedLines={STOCK_OVERVIEW_ABOUT_COLLAPSED_LINES}
          />
        ) : null}
      </Stack>
    </Stack>
  );
}
