import { useCallback, useMemo, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { Dimensions, type GestureResponderEvent, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { IDialogInstance, IScrollViewRef } from '@onekeyhq/components';
import {
  EInPageDialogType,
  HeaderScrollGestureWrapper,
  ScrollView,
  Stack,
  Tabs,
  YStack,
  useInPageDialog,
  useIsOverlayPage,
  usePageWidth,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MarketWatchListProviderMirrorV2 } from '../../MarketWatchListProviderMirrorV2';
import {
  InformationPanel,
  MarketTradingView,
  PerpetualTradingBanner,
  SwapPanel,
  TokenActivityOverview,
  TokenOverview,
} from '../components';
import { usePortfolioData } from '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import { useNetworkAccount } from '../components/InformationTabs/hooks/useNetworkAccount';
import { MobileInformationTabs } from '../components/InformationTabs/layout/MobileInformationTabs';
import { SwapPanelWrap } from '../components/SwapPanel/SwapPanelWrap';
import { useTokenDetail } from '../hooks/useTokenDetail';

export function MobileLayout({ disableTrade }: { disableTrade?: boolean }) {
  const { tokenAddress, networkId, tokenDetail, websocketConfig } =
    useTokenDetail();
  const intl = useIntl();

  const { accountAddress, xpub } = useNetworkAccount(networkId);

  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress,
    xpub,
  });
  const tabNames = useMemo(
    () => [
      intl.formatMessage({ id: ETranslations.market_chart }),
      intl.formatMessage({ id: ETranslations.global_overview }),
    ],
    [intl],
  );
  const isModalPage = useIsOverlayPage();
  const inPageDialog = useInPageDialog(
    isModalPage ? EInPageDialogType.inModalPage : EInPageDialogType.inTabPages,
  );
  const dialogRef = useRef<IDialogInstance>(null);

  const { top, bottom } = useSafeAreaInsets();

  // Skip top inset for iOS modal pages, as modal has its own safe area handling
  const isIOSModalPage = platformEnv.isNativeIOS && isModalPage;

  const height = useMemo(() => {
    if (platformEnv.isNative) {
      const topInset = isIOSModalPage ? 0 : top;
      return Dimensions.get('window').height - topInset - bottom - 158;
    }
    return 'calc(100vh - 96px - 74px)';
  }, [bottom, top, isIOSModalPage]);

  const width = usePageWidth();

  const scrollViewRef = useRef<IScrollViewRef>(null);
  const focusedTab = useSharedValue(tabNames[0]);
  const secondTabTouchStartRef = useRef<{
    pageX: number;
    pageY: number;
  } | null>(null);

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

  const handleHeaderHorizontalSwipe = useCallback(
    (direction: 'left' | 'right') => {
      const currentIndex = tabNames.indexOf(focusedTab.value);
      if (currentIndex < 0) {
        return;
      }
      const offset = direction === 'left' ? 1 : -1;
      const nextIndex = Math.min(
        tabNames.length - 1,
        Math.max(0, currentIndex + offset),
      );
      if (nextIndex === currentIndex) {
        return;
      }
      handleTabChange(tabNames[nextIndex]);
    },
    [focusedTab, handleTabChange, tabNames],
  );

  const tradingViewHeight = useMemo(() => {
    if (platformEnv.isNative) {
      return Number(height) * 0.58;
    }
    return 'calc(100vh - 96px - 74px - 250px)';
  }, [height]);

  const handleSecondTabTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      secondTabTouchStartRef.current = { pageX, pageY };
    },
    [],
  );

  const handleSecondTabTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      const start = secondTabTouchStartRef.current;
      secondTabTouchStartRef.current = null;
      if (!start) {
        return;
      }

      const { pageX, pageY } = event.nativeEvent;
      const deltaX = pageX - start.pageX;
      const deltaY = pageY - start.pageY;

      if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      handleHeaderHorizontalSwipe(deltaX < 0 ? 'left' : 'right');
    },
    [handleHeaderHorizontalSwipe],
  );

  const informationHeader = useMemo(() => {
    return (
      <YStack bg="$bgApp" pointerEvents="box-none">
        <HeaderScrollGestureWrapper
          panActiveOffsetY={[-4, 4]}
          scrollScale={1}
          onHorizontalSwipe={handleHeaderHorizontalSwipe}
          horizontalSwipeThreshold={36}
        >
          <YStack>
            <PerpetualTradingBanner px="$5" />
            <InformationPanel />
          </YStack>
        </HeaderScrollGestureWrapper>
        <HeaderScrollGestureWrapper
          panActiveOffsetY={[-4, 4]}
          panFailOffsetX={[-40, 40]}
          excludeRightEdgeRatio={0.1}
          scrollScale={1}
          onHorizontalSwipe={handleHeaderHorizontalSwipe}
          horizontalSwipeThreshold={24}
          horizontalSwipeVelocityThreshold={900}
          simultaneousWithNativeGesture
          cancelChildTouches={false}
        >
          <Stack h={tradingViewHeight} overflow="hidden">
            {networkId && tokenDetail?.symbol ? (
              <MarketTradingView
                tokenAddress={tokenAddress}
                networkId={networkId}
                tokenSymbol={tokenDetail.symbol}
                dataSource={websocketConfig?.kline ? 'websocket' : 'polling'}
              />
            ) : null}
          </Stack>
        </HeaderScrollGestureWrapper>
      </YStack>
    );
  }, [
    handleHeaderHorizontalSwipe,
    networkId,
    tokenAddress,
    tokenDetail?.symbol,
    tradingViewHeight,
    websocketConfig?.kline,
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
            <MobileInformationTabs
              onScrollEnd={noop}
              renderHeader={renderInformationHeader}
              portfolioData={portfolioData}
              isRefreshing={isRefreshing}
            />
          </YStack>
        );
      }
      return (
        <YStack flex={1} height={height}>
          <ScrollView
            onTouchStart={handleSecondTabTouchStart}
            onTouchEnd={handleSecondTabTouchEnd}
          >
            <TokenOverview />
            <TokenActivityOverview />
            <Stack h={100} w="100%" />
          </ScrollView>
        </YStack>
      );
    },
    [
      height,
      renderInformationHeader,
      portfolioData,
      isRefreshing,
      handleSecondTabTouchStart,
      handleSecondTabTouchEnd,
    ],
  );

  const toSwapPanelToken = useMemo(() => {
    return {
      networkId,
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals || 0,
      logoURI: tokenDetail?.logoUrl,
      price: tokenDetail?.price,
    };
  }, [
    networkId,
    tokenDetail?.address,
    tokenDetail?.decimals,
    tokenDetail?.logoUrl,
    tokenDetail?.price,
    tokenDetail?.symbol,
  ]);

  const showSwapDialog = (swapToken?: ISwapToken) => {
    if (swapToken) {
      dialogRef.current = inPageDialog.show({
        onClose: () => {
          appEventBus.emit(
            EAppEventBusNames.SwapPanelDismissKeyboard,
            undefined,
          );
          void dismissKeyboardWithDelay(100);
        },
        title: intl.formatMessage({ id: ETranslations.global_swap }),
        showFooter: false,
        showExitButton: true,
        renderContent: (
          <View>
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.home,
                sceneUrl: '',
              }}
              enabledNum={[0]}
            >
              <MarketWatchListProviderMirrorV2
                storeName={EJotaiContextStoreNames.marketWatchListV2}
              >
                <SwapPanelWrap
                  onCloseDialog={() => dialogRef.current?.close()}
                />
              </MarketWatchListProviderMirrorV2>
            </AccountSelectorProviderMirror>
          </View>
        ),
      });
    }
  };

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
      <SwapPanel
        swapToken={toSwapPanelToken}
        portfolioData={portfolioData}
        disableTrade={disableTrade}
        onShowSwapDialog={showSwapDialog}
      />
    </YStack>
  );
}
