import { useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  MARKET_DESKTOP_CONTENT_FRAME_PROPS,
  MARKET_DETAIL_TRADE_COLUMN_PROPS,
} from '../../marketDesktopLayoutConstants';
import { Portfolio } from '../components/InformationTabs/components/Portfolio';
import { PerpetualTradingBanner } from '../components/PerpetualTradingBanner/PerpetualTradingBanner';
import { TokenDetailHeader } from '../components/TokenDetailHeader/TokenDetailHeader';
import { TopCoinsOverviewContent } from '../components/TopCoinsOverview/TopCoinsOverviewContent';

import { TokenDetailChart } from './components/TokenDetailChart';
import { MarketEmbeddedSwap } from './MarketEmbeddedSwap';
import { TokenPriceHeader } from './TokenDesktopLayout';

const TOP_COINS_MAIN_COLUMN_WIDTH = 832;
const TOP_COINS_COLUMN_GAP = 24;

const MARKET_CHART_FULLSCREEN_STYLE = {
  position: 'fixed',
  left: 0,
  top: 0,
  right: 0,
  bottom: platformEnv.isWeb ? 40 : 0,
} as const;

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

function TopCoinsInformation({
  portfolioData,
  isRefreshing,
  tokenLogoUrl,
  accountAddress,
  isAssetDetailLoading,
  assetDetail,
}: {
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
  tokenLogoUrl?: string;
  accountAddress?: string;
  isAssetDetailLoading: boolean;
  assetDetail?: IMarketAssetDetailData;
}) {
  const intl = useIntl();
  const [tab, setTab] = useState<'overview' | 'portfolio'>('overview');

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
  } else {
    tabContent = (
      <TopCoinsOverviewContent
        assetDetail={assetDetail}
        isAssetDetailLoading={isAssetDetailLoading}
      />
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
  active,
  marketTradingView,
  swapToken,
  swapInputDraftKey,
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
  active?: boolean;
  marketTradingView: ReactNode;
  swapToken: ISwapToken;
  swapInputDraftKey: string;
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
          <YStack px="$5" pt="$5" pb="$6" gap="$4">
            <TokenPriceHeader />
            <TokenDetailChart
              active={active}
              chartContainerTestID="market-top-coins-detail-chart"
              fullscreenZIndex={chartFullscreenZIndex}
              fullscreenStyle={MARKET_CHART_FULLSCREEN_STYLE}
              marketAssetId={marketTokenId}
              marketTradingView={marketTradingView}
              isChartFullscreen={isChartFullscreen}
              chartMode={chartMode}
              isChartSwitchDisabled={isChartSwitchDisabled}
              onChartSwitch={onChartSwitch}
              onEnterChartFullscreen={onEnterChartFullscreen}
            />
          </YStack>

          <TopCoinsInformation
            portfolioData={portfolioData}
            accountAddress={accountAddress}
            isRefreshing={isRefreshing}
            tokenLogoUrl={tokenLogoUrl}
            isAssetDetailLoading={Boolean(isAssetDetailLoading)}
            assetDetail={assetDetail}
          />
        </YStack>

        <YStack {...MARKET_DETAIL_TRADE_COLUMN_PROPS}>
          {/* Keeps the trade panel aligned while Hyperliquid availability changes,
              and stays hidden once dismissed. Sits above the trade panel, where
              the pre-redesign desktop layout carried it. */}
          <PerpetualTradingBanner px="$5" py="$5" reserveSpace />
          {disableTrade ? (
            <TopCoinsUnavailableTradePanel symbol={swapToken.symbol} />
          ) : null}
          <MarketEmbeddedSwap
            swapToken={swapToken}
            inputDraftKey={swapInputDraftKey}
            disabled={disableTrade}
          />
        </YStack>
      </XStack>
    </YStack>
  );
}
