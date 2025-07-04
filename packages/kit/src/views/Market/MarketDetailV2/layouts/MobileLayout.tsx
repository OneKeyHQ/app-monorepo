import { useMemo } from 'react';

import { Stack, Tab } from '@onekeyhq/components';

import {
  InformationPanel,
  InformationTabs,
  MarketTradingView,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
  TokenOverview,
} from '../components';
import { useTokenDetail } from '../hooks/useTokenDetail';

// Extract component definitions outside render to prevent re-creation on each render
const createChartPageComponent = (
  tokenAddress: string,
  networkId: string,
  tokenSymbol?: string,
) => {
  const Component = () => (
    <>
      {/* Information Panel */}
      <InformationPanel />

      <Stack h={300}>
        <MarketTradingView
          tokenAddress={tokenAddress}
          networkId={networkId}
          tokenSymbol={tokenSymbol}
        />
      </Stack>

      {/* Information tabs */}
      <Stack h={300}>
        <InformationTabs />
      </Stack>
    </>
  );
  Component.displayName = 'ChartPageComponent';
  return Component;
};

const createOverviewPageComponent = () => {
  const Component = () => (
    <>
      {/* Token Stats */}
      <TokenOverview />

      {/* Activity overview (only in overview tab) */}
      <TokenActivityOverview />
    </>
  );
  Component.displayName = 'OverviewPageComponent';
  return Component;
};

export function MobileLayout() {
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();

  // Memoize Chart and Overview components to avoid re-creation on each render
  const ChartPageComponent = useMemo(
    () =>
      createChartPageComponent(tokenAddress, networkId, tokenDetail?.symbol),
    [tokenAddress, networkId, tokenDetail?.symbol],
  );

  const OverviewPageComponent = useMemo(
    () => createOverviewPageComponent(),
    [],
  );

  const tabs = useMemo(
    () => [
      { id: 'chart', title: 'Chart', page: ChartPageComponent },
      { id: 'overview', title: 'Overview', page: OverviewPageComponent },
    ],
    [ChartPageComponent, OverviewPageComponent],
  );

  return (
    <>
      {/* Header */}
      <TokenDetailHeader showStats={false} showMediaAndSecurity={false} />

      {/* Main Content: Chart / Overview Tabs */}
      <Tab data={tabs} />

      {/* Swap panel placed outside the tabs for global visibility */}
      <SwapPanel networkId={networkId} tokenAddress={tokenDetail?.address} />
    </>
  );
}
