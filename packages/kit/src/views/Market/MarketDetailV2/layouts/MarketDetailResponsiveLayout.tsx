import { memo } from 'react';

import { Spinner, Stack } from '@onekeyhq/components';

import { MarketDetailWatchlistSidebarFrame } from '../components/WatchlistSidebar/MarketDetailWatchlistSidebarFrame';

import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

function MarketDetailResponsiveLayoutBase({
  active,
  isLayoutPending,
  isInitialContentPending,
  isTokenDetailRequestPending,
  disablePerpsBanner,
  isDesktopLayout,
  isChartFullscreen,
  isTradingViewNative,
  onChartSwitch,
  onChartFullscreenChange,
  isNative,
  networkId,
  tokenAddress,
  marketTokenId,
  marketAssetDetail,
  isMarketAssetDetailLoading,
  marketTokenCategory,
  showFavoriteButton,
  disableTrade,
}: IMarketDetailResponsiveLayoutProps) {
  if (isDesktopLayout) {
    // The favorites sidebar wraps both states so resolving a token picked from
    // it only swaps the detail side; the list keeps its state and scroll.
    return (
      <MarketDetailWatchlistSidebarFrame hidden={isChartFullscreen}>
        {/* Resolve the layout before mounting either chart implementation.
            Replacing TokenDesktopLayout with TopCoinsDesktopLayout destroys
            their chart subtree. */}
        {isLayoutPending ? (
          <Stack
            testID="market-detail-layout-loading"
            flex={1}
            alignItems="center"
            justifyContent="center"
          >
            <Spinner size="large" />
          </Stack>
        ) : (
          <DesktopLayout
            active={active}
            isChartFullscreen={isChartFullscreen}
            isTradingViewNative={isTradingViewNative}
            onChartSwitch={onChartSwitch}
            onChartFullscreenChange={onChartFullscreenChange}
            isNative={isNative}
            networkId={networkId}
            tokenAddress={tokenAddress}
            isTokenDetailRequestPending={isTokenDetailRequestPending}
            marketTokenId={marketTokenId}
            marketAssetDetail={marketAssetDetail}
            isMarketAssetDetailLoading={isMarketAssetDetailLoading}
            marketTokenCategory={marketTokenCategory}
            disableTrade={disableTrade}
            showFavoriteButton={showFavoriteButton}
          />
        )}
      </MarketDetailWatchlistSidebarFrame>
    );
  }

  return (
    <MobileLayout
      active={active}
      isLayoutPending={isLayoutPending}
      isInitialContentPending={isInitialContentPending}
      disablePerpsBanner={disablePerpsBanner}
      disableTrade={disableTrade}
      isChartFullscreen={isChartFullscreen}
      isTradingViewNative={isTradingViewNative}
      onChartFullscreenChange={onChartFullscreenChange}
      onChartSwitch={onChartSwitch}
      isNative={isNative}
      networkId={networkId}
      tokenAddress={tokenAddress}
      marketTokenId={marketTokenId}
      marketTokenCategory={marketTokenCategory}
      marketAssetDetail={marketAssetDetail}
      isMarketAssetDetailLoading={isMarketAssetDetailLoading}
    />
  );
}

export const MarketDetailResponsiveLayout = memo(
  MarketDetailResponsiveLayoutBase,
);
