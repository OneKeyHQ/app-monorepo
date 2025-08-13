import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import type { ICarouselInstance } from '@onekeyhq/components';
import {
  Carousel,
  ScrollView,
  Stack,
  Tabs,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  const tabNames = useMemo(
    () => [
      intl.formatMessage({ id: ETranslations.market_chart }),
      intl.formatMessage({ id: ETranslations.global_overview }),
    ],
    [intl],
  );

  const carouselRef = useRef<ICarouselInstance>(null);
  const focusedTab = useSharedValue(tabNames[0]);

  const handleTabChange = useCallback(
    (tabName: string) => {
      focusedTab.value = tabName;
      carouselRef.current?.scrollTo({ index: tabNames.indexOf(tabName) });
    },
    [focusedTab, tabNames],
  );

  const height = useMemo(() => {
    return platformEnv.isNative ? undefined : 'calc(100vh - 96px)';
  }, []);

  const renderItem = useCallback(
    ({ index }: { index: number }) => {
      if (index === 0) {
        return (
          <YStack flex={1} height={height}>
            <InformationPanel />
          </YStack>
        );
      }
      return (
        <ScrollView  flex={1}>
          <TokenOverview />
          <TokenActivityOverview />
        </ScrollView>
      );
    },
    [height],
  );

  return (
    <YStack>
      <Tabs.TabBar
        divider={false}
        onTabPress={handleTabChange}
        tabNames={tabNames}
        focusedTab={focusedTab}
      />
      <Carousel
        containerStyle={{ height }}
        ref={carouselRef as any}
        pagerProps={{
          scrollSensitivity: 4,
        }}
        loop={false}
        showPagination={false}
        data={tabNames}
        renderItem={renderItem}
      />
    </YStack>
  );
  return (
    <>
      {/* Header */}

      <Tabs.Container
        headerContainerStyle={{
          width: '100%',
          shadowColor: 'transparent',
        }}
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
