import { useMemo } from 'react';
import type { ComponentProps, ComponentType, ReactNode } from 'react';

import BigNumber from 'bignumber.js';

import {
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import {
  BaseMarketTokenPrice,
  MarketTokenPrice,
} from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MARKET_DESKTOP_CONTENT_FRAME_PROPS } from '../../marketDesktopLayoutConstants';
import { TokenActivityOverview } from '../components/TokenActivityOverview/TokenActivityOverview';
import { TokenDetailHeader } from '../components/TokenDetailHeader/TokenDetailHeader';
import { TokenSupplementaryInfo } from '../components/TokenSupplementaryInfo/TokenSupplementaryInfo';
import { useMarketDetailDisplayData } from '../hooks/useMarketDetailDisplayData';
import { formatPriceChangeDisplay } from '../utils/statValue';

import { MarketDesktopChartContainer } from './components/MarketDesktopChartContainer';
import { TokenDetailChart } from './components/TokenDetailChart';
import { MarketEmbeddedSwap } from './MarketEmbeddedSwap';

import type { DesktopInformationTabs } from '../components/InformationTabs/layout/DesktopInformationTabs';

const TOKEN_DETAIL_MAIN_COLUMN_WIDTH = 832;
const TOKEN_DETAIL_TRADE_COLUMN_WIDTH = 384;
const TOKEN_DETAIL_COLUMN_GAP = 24;
const TOKEN_DETAIL_HORIZONTAL_GUTTER = 20;
const TOKEN_DETAIL_CHART_SECTION_MIN_HEIGHT = 752;
const TOKEN_DETAIL_TABS_MIN_HEIGHT = 480;

const MARKET_CHART_FULLSCREEN_STYLE = {
  position: 'fixed',
  left: 0,
  top: 0,
  right: 0,
  bottom: platformEnv.isWeb ? 40 : 0,
} as const;

type IDesktopInformationTabsProps = ComponentProps<
  typeof DesktopInformationTabs
>;

function getAbsolutePriceChange(price?: string, priceChangePercent?: string) {
  const priceBN = new BigNumber(price ?? NaN);
  const percentBN = new BigNumber(priceChangePercent ?? NaN);
  if (!priceBN.isFinite() || !percentBN.isFinite()) {
    return undefined;
  }

  const ratio = percentBN.dividedBy(100).plus(1);
  if (!ratio.isFinite() || ratio.isZero()) {
    return undefined;
  }

  return priceBN.minus(priceBN.dividedBy(ratio)).toFixed();
}

export function TokenPriceHeader() {
  const { tokenDetail, isPreviewTokenDetail } = useMarketDetailDisplayData();
  const price = tokenDetail?.price;
  const priceChangePercent = tokenDetail?.priceChange24hPercent;
  const priceChangeValue = useMemo(
    () => getAbsolutePriceChange(price, priceChangePercent),
    [price, priceChangePercent],
  );
  const { color: priceChangeColor } =
    formatPriceChangeDisplay(priceChangePercent);

  return (
    <XStack
      testID="market-token-detail-price-header"
      height={40}
      alignItems="baseline"
      gap="$3.5"
    >
      {isPreviewTokenDetail ? (
        <BaseMarketTokenPrice
          size="$heading4xl"
          price={price ?? '--'}
          tokenName={tokenDetail?.name ?? ''}
          tokenSymbol={tokenDetail?.symbol ?? ''}
        />
      ) : (
        <MarketTokenPrice
          size="$heading4xl"
          price={price ?? '--'}
          tokenName={tokenDetail?.name ?? ''}
          tokenSymbol={tokenDetail?.symbol ?? ''}
          lastUpdated={tokenDetail?.lastUpdated?.toString()}
        />
      )}

      <XStack alignItems="baseline" gap="$1.5">
        {priceChangeValue ? (
          <NumberSizeableText
            size="$bodyLgMedium"
            color={priceChangeColor}
            formatter="price"
            formatterOptions={{ showPlusMinusSigns: true }}
          >
            {priceChangeValue}
          </NumberSizeableText>
        ) : null}
        <XStack alignItems="baseline">
          {priceChangeValue ? (
            <SizableText size="$bodyLgMedium" color={priceChangeColor}>
              (
            </SizableText>
          ) : null}
          <PriceChangePercentage size="$bodyLgMedium">
            {priceChangePercent ?? '--'}
          </PriceChangePercentage>
          {priceChangeValue ? (
            <SizableText size="$bodyLgMedium" color={priceChangeColor}>
              )
            </SizableText>
          ) : null}
        </XStack>
      </XStack>
    </XStack>
  );
}

export function TokenDesktopLayout({
  marketTradingView,
  swapToken,
  portfolioData,
  isRefreshing,
  isBTCNetwork,
  isBTCMainnet,
  tokenLogoUrl,
  showFavoriteButton,
  isChartFullscreen,
  chartFullscreenZIndex,
  chartMode,
  isChartSwitchDisabled,
  disableTrade,
  onChartSwitch,
  onEnterChartFullscreen,
  InformationTabsComponent,
}: {
  marketTradingView: ReactNode;
  swapToken: ISwapToken;
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
  isBTCNetwork: boolean;
  isBTCMainnet: boolean;
  tokenLogoUrl?: string;
  showFavoriteButton: boolean;
  isChartFullscreen: boolean;
  chartFullscreenZIndex: number;
  chartMode: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  disableTrade?: boolean;
  onChartSwitch: () => void;
  onEnterChartFullscreen: () => void;
  InformationTabsComponent: ComponentType<IDesktopInformationTabsProps>;
}) {
  return (
    <YStack
      testID="market-token-detail-standard-desktop"
      {...(isChartFullscreen
        ? { width: '100%' as const }
        : MARKET_DESKTOP_CONTENT_FRAME_PROPS)}
      py="$5"
    >
      <TokenDetailHeader
        showStats={false}
        showFavoriteButton={showFavoriteButton}
        desktopRedesign
        showDivider={false}
        containerProps={{
          width: '100%',
          height: 72,
          px: '$5',
          py: '$3',
          gap: '$5',
        }}
      />

      <XStack
        testID="market-token-detail-standard-columns"
        width="100%"
        alignItems="flex-start"
        gap={TOKEN_DETAIL_COLUMN_GAP}
      >
        <YStack
          testID="market-token-detail-standard-main"
          width={TOKEN_DETAIL_MAIN_COLUMN_WIDTH}
          flex={1}
          minWidth={0}
        >
          <YStack
            minHeight={TOKEN_DETAIL_CHART_SECTION_MIN_HEIGHT}
            px={TOKEN_DETAIL_HORIZONTAL_GUTTER}
            pt="$5"
            pb="$8"
            gap="$6"
          >
            <TokenPriceHeader />
            <MarketDesktopChartContainer
              testID="market-token-detail-standard-chart"
              isFullscreen={isChartFullscreen}
              fullscreenZIndex={chartFullscreenZIndex}
              fullscreenStyle={MARKET_CHART_FULLSCREEN_STYLE}
            >
              {isChartFullscreen && platformEnv.isDesktop ? (
                <Stack height={48} bg="$bgApp" flexShrink={0} />
              ) : null}
              <TokenDetailChart
                marketTradingView={marketTradingView}
                isChartFullscreen={isChartFullscreen}
                chartMode={chartMode}
                isChartSwitchDisabled={isChartSwitchDisabled}
                onChartSwitch={onChartSwitch}
                onEnterChartFullscreen={onEnterChartFullscreen}
              />
            </MarketDesktopChartContainer>

            {isBTCMainnet ? null : <TokenActivityOverview px="$0" />}
          </YStack>

          <TokenSupplementaryInfo variant="overview" />

          <Stack minHeight={TOKEN_DETAIL_TABS_MIN_HEIGHT}>
            <InformationTabsComponent
              portfolioData={portfolioData}
              isRefreshing={isRefreshing}
              isBTCNetwork={isBTCNetwork}
              tokenLogoUrl={tokenLogoUrl}
            />
          </Stack>
        </YStack>

        <YStack
          testID="market-token-detail-standard-trade"
          width={TOKEN_DETAIL_TRADE_COLUMN_WIDTH}
          flexShrink={0}
        >
          {disableTrade ? null : <MarketEmbeddedSwap swapToken={swapToken} />}
        </YStack>
      </XStack>
    </YStack>
  );
}
