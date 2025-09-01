import { useCallback, useMemo, useRef, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import type { IScrollViewRef, IStackProps } from '@onekeyhq/components';
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
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();
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
      : 'calc(100vh - 96px)';
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

  // const [pointerEvents, setPointerEvents] =
  //   useState<IStackProps['pointerEvents']>('none');

  // const pointerEventsSharedValue = useSharedValue(pointerEvents);
  // pointerEventsSharedValue.value = pointerEvents;

  // const tradingViewContainerRef = useRef<View>(null);
  // const tradingViewPositionSharedValue = useSharedValue({
  //   minY: 255,
  //   maxY: 605,
  // });

  // const handleTradingViewContainerLayout = useCallback(() => {
  //   tradingViewContainerRef.current?.measure(
  //     (x, y, innerWidth, innerHeight, pageX, pageY) => {
  //       tradingViewPositionSharedValue.value = {
  //         minY: pageY,
  //         maxY: pageY + innerHeight,
  //       };
  //     },
  //   );
  // }, [tradingViewPositionSharedValue]);

  // const tagGesture = useMemo(() => {
  //   return Gesture.Tap().onStart((event) => {
  //     if (platformEnv.isNative) {
  //       const { minY, maxY } = tradingViewPositionSharedValue.value;
  //       const isInTradingView =
  //         event.absoluteY >= minY && event.absoluteY <= maxY;
  //       const currentPointerEvents = isInTradingView ? 'auto' : 'none';
  //       if (currentPointerEvents !== pointerEventsSharedValue.value) {
  //         runOnJS(setPointerEvents)(currentPointerEvents);
  //       }
  //     }
  //   });
  // }, [pointerEventsSharedValue, tradingViewPositionSharedValue]);

  // const setPointerEventsToNone = useCallback(() => {
  //   if (platformEnv.isNative) {
  //     if (pointerEventsSharedValue.value !== 'none') {
  //       setPointerEvents('none');
  //     }
  //   }
  // }, [pointerEventsSharedValue]);

  const renderItem = useCallback(
    ({ index }: { index: number }) => {
      if (index === 0) {
        const tradingViewHeight = platformEnv.isNative
          ? Number(height) * 0.58
          : '40vh';

        return (
          <YStack flex={1} height={height}>
            <MobileInformationTabs
              // onScrollEnd={setPointerEventsToNone}
              onScrollEnd={noop}
              renderHeader={() => (
                <YStack bg="$bgApp" pointerEvents="box-none">
                  <InformationPanel />
                  <Stack
                    h={tradingViewHeight}
                    // ref={tradingViewContainerRef}
                    position="relative"
                    // pointerEvents={
                    //   platformEnv.isNative ? pointerEvents : undefined
                    // }
                    // onLayout={handleTradingViewContainerLayout}
                  >
                    <MarketTradingView
                      tokenAddress={tokenAddress}
                      networkId={networkId}
                      tokenSymbol={tokenDetail?.symbol}
                    />
                  </Stack>
                </YStack>
              )}
            />
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
    [height, networkId, tokenAddress, tokenDetail?.symbol],
  );

  return (
    // <GestureDetector gesture={tagGesture}>
    <YStack flex={1}>
      <Tabs.TabBar
        divider={false}
        onTabPress={handleTabChange}
        tabNames={tabNames}
        focusedTab={focusedTab}
      />
      <ScrollView horizontal ref={scrollViewRef} flex={1} scrollEnabled={false}>
        {tabNames.map((item, index) => (
          <YStack key={index} h={height} w={width}>
            {renderItem({ index })}
          </YStack>
        ))}
      </ScrollView>
      <SwapPanel networkId={networkId} tokenAddress={tokenDetail?.address} />
    </YStack>
    // </GestureDetector>
  );
}
