import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Stack, Tabs } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  InformationPanel,
  MarketTradingView,
  SwapPanel,
  TokenActivityOverview,
  TokenOverview,
} from '../components';
import { MobileInformationTabs } from '../components/InformationTabs/layout/MobileInformationTabs';
import { useTokenDetail } from '../hooks/useTokenDetail';

export function MobileLayout() {
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();
  const intl = useIntl();
  const [panesCount, setPanesCount] = useState(1);

  return (
    <>
      {/* Header */}

      <Tabs.Container
        headerContainerStyle={{
          width: '100%',
          shadowColor: 'transparent',
        }}
        renderTabBar={(props) => <Tabs.TabBar {...props} />}
        pagerProps={{ scrollEnabled: false }}
      >
        <Tabs.Tab name={intl.formatMessage({ id: ETranslations.market_chart })}>
          <Tabs.ScrollView>
            {/* Information Panel */}
            <InformationPanel />

            <Stack h={350 + panesCount * 50}>
              <MarketTradingView
                tokenAddress={tokenAddress}
                networkId={networkId}
                tokenSymbol={tokenDetail?.symbol}
                onPanesCountChange={(count: number) => {
                  setPanesCount(count);
                }}
              />
            </Stack>

            <Stack h={400}>
              <MobileInformationTabs />
            </Stack>
          </Tabs.ScrollView>
        </Tabs.Tab>

        <Tabs.Tab
          name={intl.formatMessage({ id: ETranslations.global_overview })}
        >
          <Tabs.ScrollView>
            {/* Token Stats */}
            <TokenOverview />

            {/* Activity overview (only in overview tab) */}
            <TokenActivityOverview />
          </Tabs.ScrollView>
        </Tabs.Tab>
      </Tabs.Container>

      {/* Swap panel placed outside the tabs for global visibility */}
      <SwapPanel networkId={networkId} tokenAddress={tokenDetail?.address} />
    </>
  );
}
