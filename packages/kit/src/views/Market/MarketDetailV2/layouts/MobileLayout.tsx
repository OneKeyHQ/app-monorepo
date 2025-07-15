import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, ScrollView, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
    <ScrollView>
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
    </ScrollView>
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
  const [activeTab, setActiveTab] = useState<'chart' | 'overview'>('chart');
  const intl = useIntl();

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

  const renderContent = () => {
    if (activeTab === 'chart') {
      return <ChartPageComponent />;
    }
    return <OverviewPageComponent />;
  };

  return (
    <>
      {/* Header */}
      <TokenDetailHeader showStats={false} showMediaAndSecurity={false} />

      {/* Switch Buttons */}
      <XStack p="$4" gap="$2">
        <Button
          flex={1}
          variant={activeTab === 'chart' ? 'primary' : 'secondary'}
          onPress={() => setActiveTab('chart')}
        >
          {intl.formatMessage({ id: ETranslations.market_chart })}
        </Button>
        <Button
          flex={1}
          variant={activeTab === 'overview' ? 'primary' : 'secondary'}
          onPress={() => setActiveTab('overview')}
        >
          {intl.formatMessage({ id: ETranslations.global_overview })}
        </Button>
      </XStack>

      {/* Main Content */}
      {renderContent()}

      {/* Swap panel placed outside the tabs for global visibility */}
      <SwapPanel networkId={networkId} tokenAddress={tokenDetail?.address} />
    </>
  );
}
