import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Icon,
  Image,
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

import {
  buildAprRangeText,
  buildAprText,
  formatRewardText,
} from '../../../Earn/components/AprText.utils';
import { PriceChangePercentage } from '../../components/PriceChangePercentage';
import { MARKET_DESKTOP_CONTENT_FRAME_PROPS } from '../../marketDesktopLayoutConstants';
import { Portfolio } from '../components/InformationTabs/components/Portfolio';
import { PerpetualTradingBanner } from '../components/PerpetualTradingBanner/PerpetualTradingBanner';
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
// Figma 25703:19148: label (bodyMd, 20px line) + 6px gap + value (headingXl,
// 28px line).
const TOP_COINS_STAT_CELL_HEIGHT = 54;

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
    // Figma 25703:19148 lays the stats out as a 3-column grid of 54px rows,
    // matching `StockOverviewGrid`. The column width is a fixed third rather
    // than a flex share, so a wider cell can never push its row out of line.
    <YStack
      width="33.33%"
      height={TOP_COINS_STAT_CELL_HEIGHT}
      pr="$2.5"
      gap="$1.5"
    >
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <XStack alignItems="center" gap="$1.5">
        <SizableText size="$headingXl" numberOfLines={1}>
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
      <SizableText size="$headingMd">
        {intl.formatMessage({ id: ETranslations.swap_history_title })}
      </SizableText>
      <YStack bg="$bgSubdued" borderRadius="$4" p="$4" gap="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_from })}
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
          {intl.formatMessage({ id: ETranslations.global_to })}
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

// Figma 25713:20533. The percentage and the historical price form one block,
// so the item gap only separates the label from that pair.
// Figma 26430:60331: period items show the percentage alone; only the
// all-time-high item carries its price, inline after the percentage on the
// same baseline. Items lay out at their content width (flexBasis auto with
// shrink disabled — `flex={1}` would reset the basis to 0 and the wrap
// algorithm would only ever see the 112px floor, squeezing long translated
// labels into ellipses instead of wrapping); when the row cannot fit an
// item's content, the whole item wraps to the next line, and leftover space
// still spreads across the row via flexGrow.
const TOP_COINS_PERFORMANCE_ITEM_MIN_WIDTH = 112;

function TopCoinsPerformanceItem({
  label,
  percentage,
  inlinePrice,
}: {
  label: string;
  percentage?: string | number;
  inlinePrice?: string;
}) {
  return (
    <YStack
      flexGrow={1}
      flexShrink={0}
      flexBasis="auto"
      minWidth={TOP_COINS_PERFORMANCE_ITEM_MIN_WIDTH}
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
  const performanceItems = useMemo<
    {
      key: string;
      label: string;
      percentage?: string;
      inlinePrice?: string;
    }[]
  >(
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

  return (
    <YStack px="$5">
      {/* Figma 25703:19145/19146: the stats grid sits in a `py $8` wrapper and
          wraps into 54px rows separated by a 24px row gap. */}
      <YStack py="$8">
        <XStack flexWrap="wrap" rowGap="$6">
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
          <TopCoinsStatItem
            label={intl.formatMessage({ id: ETranslations.global_fdv })}
            value={formatStatValueWithFormatter(
              market?.fdv ?? tokenDetail?.fdv,
              USD_CURRENCY_FORMATTER,
            )}
          />
          <TopCoinsStatItem
            label={intl.formatMessage({
              id: ETranslations.global_total_supply,
            })}
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
      </YStack>

      {/* Each section carries its own `py $8` wrapper, so the gap between the
          stats grid and this heading is the two paddings stacked. */}
      <YStack py="$8" gap="$6">
        <SizableText size="$headingXl">
          {intl.formatMessage({ id: ETranslations.market_performance })}
        </SizableText>
        <XStack flexWrap="wrap" columnGap="$4">
          {performanceItems.map((item) => (
            <TopCoinsPerformanceItem
              key={item.key}
              label={item.label}
              percentage={item.percentage}
              inlinePrice={item.inlinePrice}
            />
          ))}
        </XStack>
      </YStack>
    </YStack>
  );
}

// Figma 25713:20673 / node 25754:19667 — the original transparent source
// bitmap (160px, ~2.9x of the 56px slot; the node export bakes in a white
// background). Baked into the bundle by product decision — the artwork is not
// expected to change often.
const TOP_COINS_EARN_ARTWORK_SIZE = 56;
const topCoinsEarnArtwork = require('@onekeyhq/kit/assets/market_earn_growth.png');

// The Earn surface renders APY as "value + one-step-smaller unit", but this row
// is a single sentence set at one size, so the APY is resolved to plain text
// here and rendered in one run. Priority mirrors `AprText` — range, then
// highlight/normal, then the raw APR — except `aprInfo.deprecated`: AprText
// renders that struck through as an expired rate, which a plain sentence
// cannot convey, so it falls through to the raw current APR instead.
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
          // Figma 25745:19636: the hover background bleeds 8px past the row on
          // each side and is rounded to 12px. The negative margin is cancelled
          // by a matching padding, so the row content itself never shifts.
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
      // Portfolio brings its own horizontal padding (header px and row
      // margin+padding both resolve to the 20px gutter), so no `px` here — an
      // outer gutter would double-indent the table. Mirrors `StockOverview`.
      <YStack pt="$5">
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
          <TopCoinsEarnSection
            earnAsset={earnAsset}
            symbol={symbol}
            onPress={handleEarnPress}
          />
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
          {/* Renders only when the token has a Hyperliquid counterpart, and
              stays hidden once dismissed. Sits above the trade panel, where the
              pre-redesign desktop layout carried it. */}
          <PerpetualTradingBanner px="$5" py="$5" />
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
