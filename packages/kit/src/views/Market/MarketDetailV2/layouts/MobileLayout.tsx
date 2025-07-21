import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { ScrollView, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SimpleTabHeader } from '../../components/SimpleTabHeader';
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

  const tabData = useMemo(
    () => [
      {
        id: 'chart' as const,
        title: intl.formatMessage({ id: ETranslations.market_chart }),
      },
      {
        id: 'overview' as const,
        title: intl.formatMessage({ id: ETranslations.global_overview }),
      },
    ],
    [intl],
  );

  const renderContent = () => {
    if (activeTab === 'chart') {
      return (
        <ScrollView>
          {/* Information Panel */}
          <InformationPanel />

          <Stack h={400}>
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
      <SimpleTabHeader
        data={tabData}
        activeIndex={activeTab === 'chart' ? 0 : 1}
        onTabPress={(index: number, tabId: 'chart' | 'overview') =>
          setActiveTab(tabId)
        }
        containerProps={{ px: '$4', py: '$0.5' }}
      />

      {/* Main Content */}
      {renderContent()}

      {/* Swap panel placed outside the tabs for global visibility */}
      <SwapPanel networkId={networkId} tokenAddress={tokenDetail?.address} />
    </>
  );
}
