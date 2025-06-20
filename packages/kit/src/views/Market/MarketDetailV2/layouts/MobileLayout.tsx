import { useMemo } from 'react';

import { Stack, Tab } from '@onekeyhq/components';
import { TradingView } from '@onekeyhq/kit/src/components/TradingView';

import {
  InformationPanel,
  InformationTabs,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
  TokenStats,
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
        <TradingView
          version="v2"
          mode="realtime"
          identifier="binance"
          baseToken={tokenSymbol ?? ''}
          targetToken="USDT"
          tokenAddress={tokenAddress}
          networkId={networkId}
          onLoadEnd={() => {}}
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
      <TokenStats />

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
      <SwapPanel />
    </>
  );
}
