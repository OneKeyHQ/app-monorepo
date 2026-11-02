import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  BaseMarketTokenPrice,
  MarketTokenPrice,
} from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import { StockMarketStatusBadge } from '../../../components/PerpsBadges';
import {
  useMarketPriceChangeLabelId,
  useMarketSimpleChartRangePriceChange,
} from '../../hooks/MarketSimpleChartRangeChangeContext';
import { useStockDetail } from '../../hooks/StockDetailContext';
import { useStockPriceSource } from '../../hooks/useStockPriceSource';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  STAT_FALLBACK_VALUE,
  formatPriceChangeDisplay,
} from '../../utils/statValue';
import { buildStockInfoFromPublicDetail } from '../../utils/stockPublicDataUtils';

import { resolveDisplayedPriceChange } from './stockMobilePriceChange';

function PriceModeButton({
  selected,
  label,
  testID,
  onPress,
}: {
  selected: boolean;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Button
      testID={testID}
      height={26}
      m="$0"
      px="$2"
      py="$0"
      borderWidth={0}
      flexShrink={0}
      size="small"
      variant={selected ? 'secondary' : 'tertiary'}
      borderRadius="$full"
      childrenAsText={false}
      onPress={onPress}
    >
      <SizableText
        size="$bodySmMedium"
        color={selected ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
    </Button>
  );
}

function StockPriceChangeLine({
  changeValueText,
  priceChangePercent,
  color,
  label,
}: {
  changeValueText?: string;
  priceChangePercent?: string;
  color: ReturnType<typeof formatPriceChangeDisplay>['color'];
  label: string;
}) {
  return (
    <XStack alignItems="center" gap="$1.5">
      {changeValueText ? (
        <NumberSizeableText
          testID="stock-mobile-price-change-value"
          size="$bodyMdMedium"
          color={color}
          formatter="price"
          formatterOptions={{ currency: '$', showPlusMinusSigns: true }}
        >
          {changeValueText}
        </NumberSizeableText>
      ) : null}
      <XStack alignItems="center">
        {changeValueText ? (
          <SizableText size="$bodyMdMedium" color={color}>
            (
          </SizableText>
        ) : null}
        <PriceChangePercentage size="$bodyMdMedium">
          {priceChangePercent ?? '--'}
        </PriceChangePercentage>
        {changeValueText ? (
          <SizableText size="$bodyMdMedium" color={color}>
            )
          </SizableText>
        ) : null}
      </XStack>
      <SizableText
        testID="stock-mobile-price-change-label"
        // Figma 25227:67442: 10px from the change, past the row's 6px gap.
        ml="$1"
        size="$bodyMd"
        color="$textSubdued"
      >
        {label}
      </SizableText>
    </XStack>
  );
}

// 36pt price, 20pt change, 2pt gap, 16pt status, 12pt row gap, and 36pt padding.
export const STOCK_MOBILE_PRICE_HEADER_HEIGHT = 122;

export function StockMobilePriceHeader() {
  const intl = useIntl();
  const {
    priceMode,
    handlePriceModeChange,
    sharePriceAvailable,
    isPriceSourceReady,
  } = useStockPriceSource();
  const { tokenDetail } = useTokenDetail();
  const { stockDetail, stockPreview, selectedTokenVariant, stockId } =
    useStockDetail();
  const sharePreview =
    stockPreview?.quote?.source === 'share' ? stockPreview.quote : undefined;
  // The list quote is explicitly labeled until the default source is known.
  const isSharePreview = !isPriceSourceReady && Boolean(sharePreview);
  const isDisplayedPriceReady = isPriceSourceReady || isSharePreview;
  const isSharePrice = isSharePreview || priceMode === 'share';
  const shareQuote =
    stockDetail?.price !== undefined ? stockDetail : sharePreview;
  const price = isSharePrice ? shareQuote?.price : tokenDetail?.price;
  // The simple chart's selected range replaces the 24h move while it is drawn.
  const rangePriceChange = useMarketSimpleChartRangePriceChange(
    isSharePrice ? 'share' : 'token',
  );
  const priceChangeLabelId = useMarketPriceChangeLabelId(
    isSharePrice ? 'share' : 'token',
  );
  const priceChangePercent =
    rangePriceChange?.priceChangePercent ??
    (isSharePrice
      ? shareQuote?.priceChange24hPercent
      : tokenDetail?.priceChange24hPercent);
  let reportedPriceChangeValue: string | undefined;
  if (rangePriceChange) {
    reportedPriceChangeValue = rangePriceChange.priceChangeValue;
  } else if (isSharePrice && stockDetail?.price !== undefined) {
    reportedPriceChangeValue = stockDetail.priceChange24hValue;
  }
  const priceChangeValue = resolveDisplayedPriceChange({
    price,
    priceChangePercent,
    reportedPriceChangeValue,
  });
  const { color: priceChangeColor } =
    formatPriceChangeDisplay(priceChangePercent);
  const stockStatus = useMemo<IMarketStockInfo | undefined>(() => {
    if (!stockDetail) return tokenDetail?.stock;
    return buildStockInfoFromPublicDetail(stockDetail, {
      source: tokenDetail?.stock?.source ?? selectedTokenVariant?.issuer,
      isPaused:
        tokenDetail?.stock?.isPaused ??
        selectedTokenVariant?.tradingHours?.isPaused,
    });
  }, [stockDetail, tokenDetail?.stock, selectedTokenVariant]);
  const changeValueText = priceChangeValue?.toFixed();
  const tokenName = stockDetail?.name ?? tokenDetail?.name ?? '';
  const tokenSymbol =
    stockDetail?.symbol ?? tokenDetail?.symbol ?? stockId ?? '';

  let priceContent = (
    <SizableText size="$heading3xl">{STAT_FALLBACK_VALUE}</SizableText>
  );
  if (!isDisplayedPriceReady) {
    priceContent = (
      <Stack height={36} justifyContent="center">
        <Skeleton width={140} height={32} />
      </Stack>
    );
  } else if (price) {
    const priceProps = {
      size: '$heading3xl' as const,
      price,
      tokenName,
      tokenSymbol,
    };
    // A list snapshot must not seed the live cache with its local receive time.
    priceContent =
      isSharePrice && stockDetail?.price === undefined ? (
        <BaseMarketTokenPrice {...priceProps} />
      ) : (
        <MarketTokenPrice
          {...priceProps}
          cacheKey={`stock-mobile-${stockId ?? 'unknown'}-${priceMode}`}
          lastUpdated={
            isSharePrice
              ? shareQuote?.quoteUpdatedAt
              : tokenDetail?.lastUpdated?.toString()
          }
        />
      );
  }

  return (
    <YStack
      testID="stock-mobile-price-header"
      minHeight={STOCK_MOBILE_PRICE_HEADER_HEIGHT}
      px="$5"
      pt="$3"
      pb="$6"
      gap="$3"
      width="100%"
    >
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
        <YStack flex={1} minWidth={0} gap="$0.5">
          {priceContent}
          {isDisplayedPriceReady ? (
            <StockPriceChangeLine
              changeValueText={changeValueText}
              priceChangePercent={priceChangePercent}
              color={priceChangeColor}
              label={intl.formatMessage({ id: priceChangeLabelId })}
            />
          ) : (
            <Stack height={20} justifyContent="center">
              <Skeleton width={100} height={16} />
            </Stack>
          )}
        </YStack>
        {sharePriceAvailable ? (
          <XStack alignItems="center" gap="$0.5" flexShrink={0} pt="$1">
            <PriceModeButton
              testID="stock-mobile-price-mode-share"
              label={intl.formatMessage({
                id: ETranslations.market_share_price,
              })}
              selected={isPriceSourceReady && priceMode === 'share'}
              onPress={() => handlePriceModeChange('share')}
            />
            <PriceModeButton
              testID="stock-mobile-price-mode-token"
              label={intl.formatMessage({
                id: ETranslations.market_token_price,
              })}
              selected={isPriceSourceReady && priceMode === 'token'}
              onPress={() => handlePriceModeChange('token')}
            />
          </XStack>
        ) : null}
      </XStack>
      {/* Keep the status row's bodySm line box while its first quote loads. */}
      <Stack
        testID="stock-mobile-market-status-row"
        minHeight={16}
        justifyContent="center"
      >
        {isSharePreview ? (
          <SizableText
            testID="stock-mobile-share-price-preview-label"
            size="$bodySm"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.market_share_price })}
            {' · '}
            {intl.formatMessage({ id: ETranslations.preview__action })}
          </SizableText>
        ) : null}
        {isPriceSourceReady ? (
          <StockMarketStatusBadge
            stock={stockStatus}
            variant="inline"
            inlineSize="sm"
            showLastUpdate={isSharePrice}
          />
        ) : null}
      </Stack>
    </YStack>
  );
}
