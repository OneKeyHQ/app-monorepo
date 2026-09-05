import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type {
  IMarketAccountPortfolioItem,
  IMarketTokenDetail as IMarketTokenDetailV2,
} from '@onekeyhq/shared/types/marketV2';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { AprText } from '../../../Earn/components/AprText';
import { PriceChangePercentage } from '../../components/PriceChangePercentage';
import { MARKET_DESKTOP_CONTENT_FRAME_PROPS } from '../../marketDesktopLayoutConstants';
import { Portfolio } from '../components/InformationTabs/components/Portfolio';
import { TokenDetailHeader } from '../components/TokenDetailHeader/TokenDetailHeader';
import { useTokenDetail } from '../hooks/useTokenDetail';
import { useTopCoinsDetail } from '../hooks/useTopCoinsDetail';
import {
  MARKET_CAP_FORMATTER,
  USD_CURRENCY_FORMATTER,
  formatStatValueWithFormatter,
} from '../utils/statValue';

import { MarketDesktopChartContainer } from './components/MarketDesktopChartContainer';
import { TokenDetailChart } from './components/TokenDetailChart';
import { MarketEmbeddedSwap } from './MarketEmbeddedSwap';
import { TokenPriceHeader } from './TokenDesktopLayout';

const TOP_COINS_MAIN_COLUMN_WIDTH = 832;
const TOP_COINS_TRADE_COLUMN_WIDTH = 384;
const TOP_COINS_COLUMN_GAP = 24;

const MARKET_CHART_FULLSCREEN_STYLE = {
  position: 'fixed',
  left: 0,
  top: 0,
  right: 0,
  bottom: platformEnv.isWeb ? 40 : 0,
} as const;

function TopCoinsStatItem({
  label,
  value,
  rank,
}: {
  label: string;
  value: string;
  rank?: number;
}) {
  return (
    <YStack flex={1} minWidth={0} gap="$1">
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <XStack alignItems="center" gap="$1.5">
        <SizableText size="$headingLg" numberOfLines={1}>
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

function TopCoinsUnavailableTradePanel({ symbol }: { symbol: string }) {
  const intl = useIntl();

  return (
    <YStack
      width="100%"
      minHeight={520}
      px="$5"
      pt="$5"
      gap="$4"
      testID="market-top-coins-trade-unavailable"
    >
      <SizableText size="$headingMd">Swap &amp; Bridge</SizableText>
      <YStack bg="$bgSubdued" borderRadius="$4" p="$4" gap="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          From
        </SizableText>
        <XStack alignItems="center" justifyContent="space-between">
          <SizableText size="$heading2xl" color="$textDisabled">
            0.0
          </SizableText>
          <SizableText size="$headingLg">USDC</SizableText>
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued">
          $0.00
        </SizableText>
      </YStack>
      <YStack bg="$bgSubdued" borderRadius="$4" p="$4" gap="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          To
        </SizableText>
        <XStack alignItems="center" justifyContent="space-between">
          <SizableText size="$heading2xl" color="$textDisabled">
            0.0
          </SizableText>
          <SizableText size="$headingLg">{symbol}</SizableText>
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued">
          $0.00
        </SizableText>
      </YStack>
      <Button
        size="large"
        disabled
        testID="market-top-coins-trade-unavailable-button"
      >
        {intl.formatMessage({
          id: ETranslations.trading_unavailable__action,
        })}
      </Button>
    </YStack>
  );
}

function normalizeAssetValue(value?: string | number | null) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return Number.isFinite(Number(value)) ? String(value) : undefined;
}

function TopCoinsPerformanceItem({
  label,
  percentage,
  referencePrice,
}: {
  label: string;
  percentage?: string | number;
  referencePrice?: string;
}) {
  return (
    <YStack flex={1} minWidth={0} gap="$1.5">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <PriceChangePercentage size="$bodyLgMedium">
        {percentage ?? '--'}
      </PriceChangePercentage>
      {referencePrice ? (
        <NumberSizeableText
          size="$bodyMd"
          formatter="price"
          formatterOptions={{ currency: '$' }}
        >
          {referencePrice}
        </NumberSizeableText>
      ) : (
        <SizableText size="$bodyMd">--</SizableText>
      )}
    </YStack>
  );
}

function TopCoinsOverview({
  assetDetail,
  tokenDetail,
}: {
  assetDetail?: IMarketAssetDetailData;
  tokenDetail?: IMarketTokenDetailV2;
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
        referencePrice: normalizeAssetValue(performance?.price7dAgo),
      },
      {
        key: '30d',
        label: '30D',
        percentage: normalizeAssetValue(performance?.priceChange30dPercent),
        referencePrice: normalizeAssetValue(performance?.price30dAgo),
      },
      {
        key: '3m',
        label: '3M',
        percentage: normalizeAssetValue(performance?.priceChange3mPercent),
        referencePrice: normalizeAssetValue(performance?.price3mAgo),
      },
      {
        key: '1y',
        label: '1Y',
        percentage: normalizeAssetValue(performance?.priceChange1yPercent),
        referencePrice: normalizeAssetValue(performance?.price1yAgo),
      },
      {
        key: 'ath',
        label: intl.formatMessage({
          id: ETranslations.market_all_time_high,
        }),
        percentage: normalizeAssetValue(performance?.allTimeHighChangePercent),
        referencePrice: normalizeAssetValue(performance?.allTimeHighPrice),
      },
    ],
    [intl, performance],
  );

  return (
    <YStack px="$5" pt="$10" pb="$12" gap="$12">
      <XStack gap="$8">
        <TopCoinsStatItem
          label={intl.formatMessage({ id: ETranslations.global_market_cap })}
          value={formatStatValueWithFormatter(
            market?.marketCap ?? tokenDetail?.marketCap,
            USD_CURRENCY_FORMATTER,
          )}
          rank={market?.marketCapRank ?? undefined}
        />
        <TopCoinsStatItem
          label={intl.formatMessage({
            id: ETranslations.dexmarket_stock_24h_volume,
          })}
          value={formatStatValueWithFormatter(
            market?.volume24h ?? tokenDetail?.volume24h,
            USD_CURRENCY_FORMATTER,
          )}
        />
        <TopCoinsStatItem
          label={intl.formatMessage({
            id: ETranslations.global_circulating_supply,
          })}
          value={formatStatValueWithFormatter(
            market?.circulatingSupply ?? tokenDetail?.circulatingSupply,
            MARKET_CAP_FORMATTER,
          )}
        />
      </XStack>
      <XStack gap="$8">
        <TopCoinsStatItem
          label={intl.formatMessage({ id: ETranslations.global_fdv })}
          value={formatStatValueWithFormatter(
            market?.fdv ?? tokenDetail?.fdv,
            USD_CURRENCY_FORMATTER,
          )}
        />
        <TopCoinsStatItem
          label={intl.formatMessage({ id: ETranslations.global_total_supply })}
          value={`${formatStatValueWithFormatter(
            market?.totalSupply,
            MARKET_CAP_FORMATTER,
          )}${symbol ? ` ${symbol}` : ''}`}
        />
        <TopCoinsStatItem
          label={intl.formatMessage({ id: ETranslations.global_max_supply })}
          value={formatStatValueWithFormatter(
            market?.maxSupply,
            MARKET_CAP_FORMATTER,
          )}
        />
      </XStack>

      <YStack gap="$6">
        <SizableText size="$headingLg">Performance</SizableText>
        <XStack gap="$6">
          {performanceItems.map((item) => (
            <TopCoinsPerformanceItem
              key={item.key}
              label={item.label}
              percentage={item.percentage}
              referencePrice={item.referencePrice}
            />
          ))}
        </XStack>
      </YStack>
    </YStack>
  );
}

function TopCoinsInformation({
  portfolioData,
  isRefreshing,
  tokenLogoUrl,
  accountAddress,
  earnAsset,
  isAssetDetailLoading,
  assetDetail,
}: {
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
  tokenLogoUrl?: string;
  accountAddress?: string;
  earnAsset?: IRecommendAsset;
  isAssetDetailLoading: boolean;
  assetDetail?: IMarketAssetDetailData;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [tab, setTab] = useState<'overview' | 'portfolio'>('overview');
  const { tokenDetail } = useTokenDetail();
  const symbol = assetDetail?.asset.symbol ?? tokenDetail?.symbol ?? '';

  const handleEarnPress = useCallback(() => {
    // The Earn surface performs its own protocol filtering and account setup.
    // This CTA intentionally enters that surface instead of duplicating the
    // staking flow inside Market detail.
    navigation.switchTab(ETabRoutes.Earn);
  }, [navigation]);

  let tabContent: ReactNode;
  if (tab === 'portfolio') {
    tabContent = (
      <YStack px="$5" pt="$5">
        <Portfolio
          standalone
          accountAddress={accountAddress}
          portfolioData={portfolioData}
          isRefreshing={isRefreshing}
          tokenLogoUrl={tokenLogoUrl}
        />
      </YStack>
    );
  } else if (isAssetDetailLoading && !assetDetail) {
    tabContent = (
      <YStack px="$5" pt="$10" gap="$8">
        <Skeleton height={112} width="100%" />
        <Skeleton height={152} width="100%" />
      </YStack>
    );
  } else {
    tabContent = (
      <>
        <TopCoinsOverview assetDetail={assetDetail} tokenDetail={tokenDetail} />

        {earnAsset ? (
          <YStack px="$5" pb="$12" gap="$5">
            <SizableText size="$headingLg">
              {`${intl.formatMessage({
                id: ETranslations.global_earn,
              })} ${symbol}`}
            </SizableText>
            <XStack
              py="$3"
              alignItems="center"
              cursor="pointer"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              onPress={handleEarnPress}
            >
              <SizableText size="$headingLg" mr="$2">
                ↗
              </SizableText>
              <XStack alignItems="center" flex={1} gap="$1">
                <SizableText size="$bodyLgMedium">
                  {intl.formatMessage({ id: ETranslations.global_earn })}
                </SizableText>
                <AprText
                  size="$bodyLgMedium"
                  asset={{
                    aprWithoutFee: earnAsset.aprWithoutFee,
                    aprInfo: earnAsset.aprInfo,
                    rewardUnit: earnAsset.rewardUnit,
                    minAprInfo: earnAsset.minAprInfo,
                    maxAprInfo: earnAsset.maxAprInfo,
                  }}
                />
                <SizableText size="$bodyLgMedium">
                  {`on your ${symbol}`}
                </SizableText>
              </XStack>
              <SizableText color="$textSubdued">›</SizableText>
            </XStack>
          </YStack>
        ) : null}
      </>
    );
  }

  return (
    <YStack minHeight={620}>
      <XStack height={44} px="$5" gap="$5" alignItems="stretch">
        <XStack
          alignItems="center"
          borderBottomWidth={tab === 'overview' ? 2 : 0}
          borderBottomColor="$borderActive"
          cursor="pointer"
          onPress={() => setTab('overview')}
        >
          <SizableText
            size="$bodyLgMedium"
            color={tab === 'overview' ? '$text' : '$textSubdued'}
          >
            {intl.formatMessage({ id: ETranslations.global_overview })}
          </SizableText>
        </XStack>
        <XStack
          alignItems="center"
          borderBottomWidth={tab === 'portfolio' ? 2 : 0}
          borderBottomColor="$borderActive"
          cursor="pointer"
          onPress={() => setTab('portfolio')}
        >
          <SizableText
            size="$bodyLgMedium"
            color={tab === 'portfolio' ? '$text' : '$textSubdued'}
          >
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_myposition,
            })}
          </SizableText>
        </XStack>
      </XStack>

      {tabContent}
    </YStack>
  );
}

export function TopCoinsDesktopLayout({
  marketTradingView,
  swapToken,
  portfolioData,
  accountAddress,
  isRefreshing,
  tokenLogoUrl,
  showFavoriteButton,
  isChartFullscreen,
  chartFullscreenZIndex,
  marketTokenId,
  assetDetail,
  isAssetDetailLoading,
  disableTrade,
  chartMode,
  isChartSwitchDisabled,
  onChartSwitch,
  onEnterChartFullscreen,
}: {
  marketTradingView: ReactNode;
  swapToken: ISwapToken;
  portfolioData: IMarketAccountPortfolioItem[];
  accountAddress?: string;
  isRefreshing?: boolean;
  tokenLogoUrl?: string;
  showFavoriteButton: boolean;
  isChartFullscreen: boolean;
  chartFullscreenZIndex: number;
  marketTokenId?: string;
  assetDetail?: IMarketAssetDetailData;
  isAssetDetailLoading?: boolean;
  disableTrade?: boolean;
  chartMode: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch: () => void;
  onEnterChartFullscreen: () => void;
}) {
  const { earnAsset } = useTopCoinsDetail(assetDetail);

  return (
    <YStack
      testID="market-top-coins-detail-desktop"
      {...(isChartFullscreen
        ? { width: '100%' as const }
        : MARKET_DESKTOP_CONTENT_FRAME_PROPS)}
      py="$5"
    >
      <TokenDetailHeader
        chartMode={chartMode}
        showStats={false}
        showFavoriteButton={showFavoriteButton}
        desktopRedesign
        desktopDetailVariant="topCoins"
        showDivider={false}
        containerProps={{
          width: '100%',
          height: 72,
          px: '$5',
          py: '$3',
          gap: '$5',
        }}
      />

      <XStack width="100%" alignItems="flex-start" gap={TOP_COINS_COLUMN_GAP}>
        <YStack width={TOP_COINS_MAIN_COLUMN_WIDTH} flex={1} minWidth={0}>
          <YStack px="$5" pt="$5" pb="$6" gap="$6">
            <TokenPriceHeader />
            <MarketDesktopChartContainer
              testID="market-top-coins-detail-chart"
              isFullscreen={isChartFullscreen}
              fullscreenZIndex={chartFullscreenZIndex}
              fullscreenStyle={MARKET_CHART_FULLSCREEN_STYLE}
            >
              {isChartFullscreen && platformEnv.isDesktop ? (
                <Stack height={48} bg="$bgApp" flexShrink={0} />
              ) : null}
              <TokenDetailChart
                marketAssetId={marketTokenId}
                marketTradingView={marketTradingView}
                isChartFullscreen={isChartFullscreen}
                chartMode={chartMode}
                isChartSwitchDisabled={isChartSwitchDisabled}
                onChartSwitch={onChartSwitch}
                onEnterChartFullscreen={onEnterChartFullscreen}
              />
            </MarketDesktopChartContainer>
          </YStack>

          <TopCoinsInformation
            portfolioData={portfolioData}
            accountAddress={accountAddress}
            isRefreshing={isRefreshing}
            tokenLogoUrl={tokenLogoUrl}
            earnAsset={earnAsset}
            isAssetDetailLoading={Boolean(isAssetDetailLoading)}
            assetDetail={assetDetail}
          />
        </YStack>

        <YStack width={TOP_COINS_TRADE_COLUMN_WIDTH} flexShrink={0}>
          {disableTrade ? (
            <TopCoinsUnavailableTradePanel symbol={swapToken.symbol} />
          ) : (
            <MarketEmbeddedSwap swapToken={swapToken} />
          )}
        </YStack>
      </XStack>
    </YStack>
  );
}
