import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Image,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  buildAprRangeText,
  buildAprText,
  formatRewardText,
} from '@onekeyhq/kit/src/views/Earn/components/AprText.utils';
import { EarnNavigation } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail as IMarketTokenDetailV2 } from '@onekeyhq/shared/types/marketV2';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { PriceChangePercentage } from '../../../components/PriceChangePercentage';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import { useTopCoinsDetail } from '../../hooks/useTopCoinsDetail';
import {
  MARKET_CAP_FORMATTER,
  USD_CURRENCY_FORMATTER,
  formatStatValueWithFormatter,
} from '../../utils/statValue';
import { MarketAboutDescription } from '../MarketAboutDescription';

// Figma 25703:19148: label (bodyMd, 20px line) + 6px gap + value (headingXl,
// 28px line).
const TOP_COINS_STAT_CELL_HEIGHT = 54;
// Figma 25713:20533. Period items show the percentage alone; only the
// all-time-high item carries its price. Items lay out at content width so a
// long translated label wraps as a whole instead of being cut off.
const TOP_COINS_PERFORMANCE_ITEM_MIN_WIDTH = 112;
const TOP_COINS_EARN_ARTWORK_SIZE = 56;
const topCoinsEarnArtwork = require('@onekeyhq/kit/assets/market_earn_growth.png');

function normalizeAssetValue(value?: string | number | null) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return Number.isFinite(Number(value)) ? String(value) : undefined;
}

function TopCoinsStatItem({
  label,
  value,
  rank,
  width = '33.33%',
  valueSize = '$headingXl',
}: {
  label: string;
  value: string;
  rank?: number;
  width?: '33.33%' | '50%';
  valueSize?: '$headingXl' | '$headingLg';
}) {
  return (
    <YStack
      width={width}
      height={TOP_COINS_STAT_CELL_HEIGHT}
      pr="$2.5"
      gap="$1.5"
    >
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <XStack alignItems="center" gap="$1.5">
        <SizableText size={valueSize} numberOfLines={1}>
          {value}
        </SizableText>
        {rank ? (
          <Badge badgeType="default" badgeSize="sm">
            <Badge.Text>{`#${rank}`}</Badge.Text>
          </Badge>
        ) : null}
      </XStack>
    </YStack>
  );
}

function TopCoinsPerformanceItem({
  label,
  percentage,
  inlinePrice,
  width,
}: {
  label: string;
  percentage?: string | number;
  inlinePrice?: string;
  width?: '50%';
}) {
  return (
    <YStack
      flexGrow={width ? 0 : 1}
      flexShrink={0}
      flexBasis="auto"
      width={width}
      minWidth={width ? 0 : TOP_COINS_PERFORMANCE_ITEM_MIN_WIDTH}
      py="$2"
      justifyContent="center"
      gap="$2.5"
    >
      <SizableText size="$bodyMdMedium" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <XStack gap="$2" alignItems="baseline">
        <PriceChangePercentage size="$headingLg" numberOfLines={1}>
          {percentage ?? '--'}
        </PriceChangePercentage>
        {inlinePrice ? (
          <NumberSizeableText
            size="$bodyMd"
            formatter="price"
            formatterOptions={{ currency: '$' }}
            numberOfLines={1}
          >
            {inlinePrice}
          </NumberSizeableText>
        ) : null}
      </XStack>
    </YStack>
  );
}

function TopCoinsStatsAndPerformance({
  assetDetail,
  tokenDetail,
  columns,
}: {
  assetDetail?: IMarketAssetDetailData;
  tokenDetail?: IMarketTokenDetailV2;
  columns: 2 | 3;
}) {
  const intl = useIntl();
  const market = assetDetail?.market;
  const performance = assetDetail?.performance;
  const symbol = assetDetail?.asset.symbol ?? tokenDetail?.symbol ?? '';
  const performanceItems = useMemo(
    () => [
      {
        key: '7d',
        label: '7D',
        percentage: normalizeAssetValue(performance?.priceChange7dPercent),
      },
      {
        key: '30d',
        label: '30D',
        percentage: normalizeAssetValue(performance?.priceChange30dPercent),
      },
      {
        key: '3m',
        label: '3M',
        percentage: normalizeAssetValue(performance?.priceChange3mPercent),
      },
      {
        key: '1y',
        label: '1Y',
        percentage: normalizeAssetValue(performance?.priceChange1yPercent),
      },
      {
        key: 'ath',
        label: intl.formatMessage({
          id: ETranslations.market_all_time_high,
        }),
        percentage: normalizeAssetValue(performance?.allTimeHighChangePercent),
        inlinePrice: normalizeAssetValue(performance?.allTimeHighPrice),
      },
    ],
    [intl, performance],
  );

  const statWidth = columns === 2 ? '50%' : '33.33%';
  const valueSize = columns === 2 ? '$headingLg' : '$headingXl';
  const performanceWidth = columns === 2 ? '50%' : undefined;

  return (
    <YStack px="$5">
      <YStack py={columns === 2 ? '$5' : '$8'}>
        <XStack flexWrap="wrap" rowGap="$6">
          <TopCoinsStatItem
            width={statWidth}
            valueSize={valueSize}
            label={intl.formatMessage({ id: ETranslations.global_market_cap })}
            value={formatStatValueWithFormatter(
              market?.marketCap ?? tokenDetail?.marketCap,
              USD_CURRENCY_FORMATTER,
            )}
            rank={market?.marketCapRank ?? undefined}
          />
          <TopCoinsStatItem
            width={statWidth}
            valueSize={valueSize}
            label={intl.formatMessage({
              id: ETranslations.dexmarket_stock_24h_volume,
            })}
            value={formatStatValueWithFormatter(
              market?.volume24h ?? tokenDetail?.volume24h,
              USD_CURRENCY_FORMATTER,
            )}
          />
          <TopCoinsStatItem
            width={statWidth}
            valueSize={valueSize}
            label={intl.formatMessage({
              id: ETranslations.global_circulating_supply,
            })}
            value={formatStatValueWithFormatter(
              market?.circulatingSupply ?? tokenDetail?.circulatingSupply,
              MARKET_CAP_FORMATTER,
            )}
          />
          <TopCoinsStatItem
            width={statWidth}
            valueSize={valueSize}
            label={intl.formatMessage({ id: ETranslations.global_fdv })}
            value={formatStatValueWithFormatter(
              market?.fdv ?? tokenDetail?.fdv,
              USD_CURRENCY_FORMATTER,
            )}
          />
          <TopCoinsStatItem
            width={statWidth}
            valueSize={valueSize}
            label={intl.formatMessage({
              id: ETranslations.global_total_supply,
            })}
            value={`${formatStatValueWithFormatter(
              market?.totalSupply,
              MARKET_CAP_FORMATTER,
            )}${symbol ? ` ${symbol}` : ''}`}
          />
          <TopCoinsStatItem
            width={statWidth}
            valueSize={valueSize}
            label={intl.formatMessage({ id: ETranslations.global_max_supply })}
            value={
              market?.maxSupply === 'unlimited'
                ? '∞'
                : formatStatValueWithFormatter(
                    market?.maxSupply,
                    MARKET_CAP_FORMATTER,
                  )
            }
          />
        </XStack>
      </YStack>
      <YStack py={columns === 2 ? '$5' : '$8'} gap="$6">
        <SizableText size="$headingXl">
          {intl.formatMessage({ id: ETranslations.market_performance })}
        </SizableText>
        <XStack flexWrap="wrap" columnGap={columns === 2 ? 0 : '$4'}>
          {performanceItems.map((item) => (
            <TopCoinsPerformanceItem
              key={item.key}
              label={item.label}
              percentage={item.percentage}
              inlinePrice={item.inlinePrice}
              width={performanceWidth}
            />
          ))}
        </XStack>
      </YStack>
    </YStack>
  );
}

function resolveEarnAprText(earnAsset: IRecommendAsset) {
  const rewardUnit = earnAsset.rewardUnit ?? 'APR';
  const rangeText = buildAprRangeText({
    minAprInfo: earnAsset.minAprInfo,
    maxAprInfo: earnAsset.maxAprInfo,
    rewardUnit,
  });
  if (rangeText) {
    return rangeText;
  }
  const { aprInfo } = earnAsset;
  const infoText = aprInfo?.highlight?.text ?? aprInfo?.normal?.text;
  if (infoText) {
    return formatRewardText({ text: infoText, rewardUnit, hideSuffix: false });
  }
  return buildAprText(earnAsset.aprWithoutFee, rewardUnit);
}

function TopCoinsEarnSection({
  earnAsset,
  symbol,
  onPress,
}: {
  earnAsset: IRecommendAsset;
  symbol: string;
  onPress: () => void;
}) {
  const intl = useIntl();
  const aprText = resolveEarnAprText(earnAsset);

  return (
    <YStack px="$5">
      <YStack py="$8" gap="$6">
        <SizableText size="$headingXl">
          {intl.formatMessage(
            { id: ETranslations.market_earn_title_with_symbol },
            { symbol },
          )}
        </SizableText>
        <XStack
          testID="top-coins-earn-entry"
          minHeight={48}
          mx={-8}
          px={8}
          py="$2"
          gap="$4"
          alignItems="center"
          cursor="pointer"
          borderRadius="$3"
          borderCurve="continuous"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={onPress}
        >
          <Image
            source={topCoinsEarnArtwork}
            width={TOP_COINS_EARN_ARTWORK_SIZE}
            height={TOP_COINS_EARN_ARTWORK_SIZE}
          />
          <SizableText
            size="$headingLg"
            flex={1}
            flexBasis={0}
            minWidth={0}
            numberOfLines={2}
          >
            {intl.formatMessage(
              { id: ETranslations.market_earn_cta },
              { apr: aprText, symbol },
            )}
          </SizableText>
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      </YStack>
    </YStack>
  );
}

export function TopCoinsOverviewContent({
  assetDetail,
  isAssetDetailLoading,
  columns = 3,
}: {
  assetDetail?: IMarketAssetDetailData;
  isAssetDetailLoading?: boolean;
  // Desktop keeps the three-column grid. Mobile overview is two columns.
  columns?: 2 | 3;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { tokenDetail } = useTokenDetail();
  const { earnAsset } = useTopCoinsDetail(assetDetail);
  const symbol = assetDetail?.asset.symbol ?? tokenDetail?.symbol ?? '';
  const about = assetDetail?.about?.trim();
  const earnProtocol = earnAsset?.protocols[0];

  const handleEarnPress = useCallback(() => {
    if (!earnAsset || !earnProtocol) {
      return;
    }
    void EarnNavigation.pushToEarnProtocolDetails(navigation, {
      networkId: earnProtocol.networkId,
      symbol: earnAsset.symbol,
      provider: earnProtocol.provider,
      vault: earnProtocol.vault,
      logoURI: earnAsset.logoURI,
    });
  }, [earnAsset, earnProtocol, navigation]);

  if (isAssetDetailLoading && !assetDetail) {
    return (
      <YStack px="$5" pt="$10" gap="$8">
        <Skeleton height={112} width="100%" />
        <Skeleton height={152} width="100%" />
      </YStack>
    );
  }

  return (
    <>
      <TopCoinsStatsAndPerformance
        assetDetail={assetDetail}
        tokenDetail={tokenDetail}
        columns={columns}
      />
      {earnAsset && earnProtocol ? (
        <TopCoinsEarnSection
          earnAsset={earnAsset}
          symbol={symbol}
          onPress={handleEarnPress}
        />
      ) : null}
      {about ? (
        <YStack testID="top-coins-about" px="$5" py="$8" gap="$6">
          <SizableText size="$headingXl">
            {intl.formatMessage(
              { id: ETranslations.market_about_title },
              { ticker: symbol },
            )}
          </SizableText>
          <MarketAboutDescription
            description={about}
            testID="top-coins-about-description"
            toggleTestID="top-coins-about-description-toggle"
          />
        </YStack>
      ) : null}
    </>
  );
}
