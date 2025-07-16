import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, ScrollView, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  InformationPanel,
  MarketTradingView,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
  TokenOverview,
} from '../components';
import { MobileInformationTabs } from '../components/InformationTabs/layout/MobileInformationTabs';
import { useTokenDetail } from '../hooks/useTokenDetail';

export function MobileLayout() {
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();
  const [activeTab, setActiveTab] = useState<'chart' | 'overview'>('chart');
  const intl = useIntl();

  const renderContent = () => {
    if (activeTab === 'chart') {
      return (
        <ScrollView>
          {/* Information Panel */}
          <InformationPanel />

          <Stack h={300}>
            <MarketTradingView
              tokenAddress={tokenAddress}
              networkId={networkId}
              tokenSymbol={tokenDetail?.symbol}
            />
          </Stack>

          {/* Information tabs */}
          <Stack h={300}>
            <MobileInformationTabs />
          </Stack>
        </ScrollView>
      );
    }
    return (
      <ScrollView>
        {/* Token Stats */}
        <TokenOverview />

        {/* Activity overview (only in overview tab) */}
        <TokenActivityOverview />
      </ScrollView>
    );
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
