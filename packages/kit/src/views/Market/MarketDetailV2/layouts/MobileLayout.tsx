import { useMemo } from 'react';

import { Stack, Tab } from '@onekeyhq/components';
import { TradingView } from '@onekeyhq/kit/src/components/TradingView';
import type { IMarketTokenDetail as IMarketTokenDetailV2 } from '@onekeyhq/shared/types/marketV2';

import {
  InformationPanel,
  InformationTabs,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
  TokenStats,
} from '../components';

interface IMobileLayoutProps {
  tokenAddress: string;
  networkId: string;
  tokenDetail?: IMarketTokenDetailV2;
}

// Extract component definitions outside render to prevent re-creation on each render
// prettier-ignore
const createChartPageComponent = (
  tokenAddress: string,
  networkId: string,
  tokenDetail?: IMarketTokenDetailV2,
) => {
  const Component = () => (
    <>
      {/* Information Panel */}
      <InformationPanel tokenDetail={tokenDetail} networkId={networkId} />

      <Stack h={300}>
        <TradingView
          mode="realtime"
          identifier="binance"
          baseToken={tokenDetail?.symbol ?? ''}
          targetToken="USDT"
          tokenAddress={tokenAddress}
          networkId={networkId}
          onLoadEnd={() => {}}
        />
      </Stack>

      {/* Information tabs */}
      <Stack h={300}>
        <InformationTabs tokenAddress={tokenAddress} networkId={networkId} />
      </Stack>
    </>
  );
  Component.displayName = 'ChartPageComponent';
  return Component;
};

const createOverviewPageComponent = (tokenDetail?: IMarketTokenDetailV2) => {
  const Component = () => (
    <>
      {/* Token Stats */}
      <TokenStats tokenDetail={tokenDetail} />

      {/* Activity overview (only in overview tab) */}
      <TokenActivityOverview tokenDetail={tokenDetail} />
    </>
  );
  Component.displayName = 'OverviewPageComponent';
  return Component;
};

export function MobileLayout({
  tokenAddress,
  networkId,
  tokenDetail,
}: IMobileLayoutProps) {
  // Memoize Chart and Overview components to avoid re-creation on each render
  const ChartPageComponent = useMemo(
    () => createChartPageComponent(tokenAddress, networkId, tokenDetail),
    [tokenAddress, networkId, tokenDetail],
  );

  const OverviewPageComponent = useMemo(
    () => createOverviewPageComponent(tokenDetail),
    [tokenDetail],
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
      <TokenDetailHeader
        tokenDetail={tokenDetail}
        networkId={networkId}
        showStats={false}
        showMediaAndSecurity={false}
      />

      {/* Main Content: Chart / Overview Tabs */}
      <Tab data={tabs} />

      {/* Swap panel placed outside the tabs for global visibility */}
      <SwapPanel tokenDetail={tokenDetail} networkId={networkId} />
    </>
  );
}
