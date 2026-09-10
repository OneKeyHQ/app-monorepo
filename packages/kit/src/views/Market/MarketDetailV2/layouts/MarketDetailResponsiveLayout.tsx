import { Spinner, Stack } from '@onekeyhq/components';

import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  isLayoutPending,
  isInitialContentPending,
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
    // Resolve the layout before mounting either chart implementation. Replacing
    // TokenDesktopLayout with TopCoinsDesktopLayout destroys their chart subtree.
    if (isLayoutPending) {
      return (
        <Stack
          testID="market-detail-layout-loading"
          flex={1}
          alignItems="center"
          justifyContent="center"
        >
          <Spinner size="large" />
        </Stack>
      );
    }
    return (
      <DesktopLayout
        isChartFullscreen={isChartFullscreen}
        isTradingViewNative={isTradingViewNative}
        onChartSwitch={onChartSwitch}
        onChartFullscreenChange={onChartFullscreenChange}
        isNative={isNative}
        networkId={networkId}
        tokenAddress={tokenAddress}
        marketTokenId={marketTokenId}
        marketAssetDetail={marketAssetDetail}
        isMarketAssetDetailLoading={isMarketAssetDetailLoading}
        marketTokenCategory={marketTokenCategory}
        disableTrade={disableTrade}
        showFavoriteButton={showFavoriteButton}
      />
    );
  }

  return (
    <MobileLayout
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
    />
  );
}
