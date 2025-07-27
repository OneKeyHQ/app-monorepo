import { useIntl } from 'react-intl';

import { ScrollView, Stack, Tabs } from '@onekeyhq/components';
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

  return (
    <>
      {/* Header */}

      <Tabs.Container
        headerContainerStyle={{
          width: '100%',
          shadowColor: 'transparent',
        }}
        renderTabBar={(props) => <Tabs.TabBar {...props} />}
      >
        <Tabs.Tab name={intl.formatMessage({ id: ETranslations.market_chart })}>
          <Stack width="100%" height={50} />

          {/* Information Panel */}
          <InformationPanel />

          <Stack h={400}>
            <MarketTradingView
              tokenAddress={tokenAddress}
              networkId={networkId}
              tokenSymbol={tokenDetail?.symbol}
            />
          </Stack>

          <MobileInformationTabs />
        </Tabs.Tab>

        <Tabs.Tab
          name={intl.formatMessage({ id: ETranslations.global_overview })}
        >
          <ScrollView>
            <Stack width="100%" height={50} />

            {/* Token Stats */}
            <TokenOverview />

            {/* Activity overview (only in overview tab) */}
            <TokenActivityOverview />
          </ScrollView>
        </Tabs.Tab>
      </Tabs.Container>

      {/* Swap panel placed outside the tabs for global visibility */}
      <SwapPanel networkId={networkId} tokenAddress={tokenDetail?.address} />
    </>
  );
}
