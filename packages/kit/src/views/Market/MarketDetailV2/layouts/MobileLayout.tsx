import { useCallback, useMemo, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { Dimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { IScrollViewRef } from '@onekeyhq/components';
import {
  ScrollView,
  Stack,
  Tabs,
  YStack,
  useSafeAreaInsets,
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
  const { tokenAddress, networkId, tokenDetail, isNative, websocketConfig } =
    useTokenDetail();
  const intl = useIntl();
  const tabNames = useMemo(
    () => [
      intl.formatMessage({ id: ETranslations.market_chart }),
      intl.formatMessage({ id: ETranslations.global_overview }),
    ],
    [intl],
  );

  const { top, bottom } = useSafeAreaInsets();

  const height = useMemo(() => {
    return platformEnv.isNative
      ? Dimensions.get('window').height - top - bottom - 158
      : 'calc(100vh - 96px - 74px)';
  }, [bottom, top]);

  const width = useMemo(() => {
    return Dimensions.get('window').width;
  }, []);

  const scrollViewRef = useRef<IScrollViewRef>(null);
  const focusedTab = useSharedValue(tabNames[0]);

  const handleTabChange = useCallback(
    (tabName: string) => {
      focusedTab.value = tabName;
      scrollViewRef.current?.scrollTo({
        x: width * tabNames.indexOf(tabName),
        animated: true,
      });
    },
    [focusedTab, tabNames, width],
  );

  const tradingViewHeight = useMemo(() => {
    if (isNative) {
      return Number(height) * 0.9;
    }
    if (platformEnv.isNative) {
      return Number(height) * 0.58;
    }
    return '40vh';
  }, [height, isNative]);

  const informationHeader = useMemo(() => {
    return (
      <YStack bg="$bgApp" pointerEvents="box-none">
        <InformationPanel />
        <Stack h={tradingViewHeight} position="relative">
          <MarketTradingView
            tokenAddress={tokenAddress}
            networkId={networkId}
            tokenSymbol={tokenDetail?.symbol}
            isNative={isNative}
            dataSource={websocketConfig?.kline ? 'websocket' : 'polling'}
          />
        </Stack>
      </YStack>
    );
  }, [
    isNative,
    networkId,
    tokenAddress,
    tokenDetail?.symbol,
    tradingViewHeight,
    websocketConfig,
  ]);

  const renderInformationHeader = useCallback(
    () => informationHeader,
    [informationHeader],
  );

  const renderItem = useCallback(
    ({ index }: { index: number }) => {
      if (index === 0) {
        return (
          <YStack flex={1} height={height}>
            {isNative ? (
              informationHeader
            ) : (
              <MobileInformationTabs
                onScrollEnd={noop}
                renderHeader={renderInformationHeader}
              />
            )}
          </YStack>
        );
      }
      return (
        <YStack flex={1} height={height}>
          <ScrollView>
            <TokenOverview />
            <TokenActivityOverview />
            <Stack h={100} w="100%" />
          </ScrollView>
        </YStack>
      );
    },
    [height, isNative, informationHeader, renderInformationHeader],
  );

  return (
    <YStack flex={1} position="relative">
      <Tabs.TabBar
        divider={false}
        onTabPress={handleTabChange}
        tabNames={tabNames}
        focusedTab={focusedTab}
      />
      <ScrollView horizontal ref={scrollViewRef} flex={1} scrollEnabled={false}>
        {tabNames.map((_, index) => (
          <YStack key={index} h={height} w={width}>
            {renderItem({ index })}
          </YStack>
        ))}
      </ScrollView>

      {isNative ? null : (
        <SwapPanel networkId={networkId} tokenAddress={tokenDetail?.address} />
      )}
    </YStack>
  );
}
