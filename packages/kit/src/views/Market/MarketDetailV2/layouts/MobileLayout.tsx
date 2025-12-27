import { useCallback, useMemo, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { Dimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { IDialogInstance, IScrollViewRef } from '@onekeyhq/components';
import {
  EInPageDialogType,
  ScrollView,
  Stack,
  Tabs,
  YStack,
  useInPageDialog,
  useIsOverlayPage,
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
  SwapPanel,
  TokenActivityOverview,
  TokenOverview,
} from '../components';
import { usePortfolioData } from '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import { useNetworkAccountAddress } from '../components/InformationTabs/hooks/useNetworkAccountAddress';
import { MobileInformationTabs } from '../components/InformationTabs/layout/MobileInformationTabs';
import SwapFlashBtn from '../components/SwapPanel/components/SwapFlashBtn';
import { SwapPanelWrap } from '../components/SwapPanel/SwapPanelWrap';
import { useTokenDetail } from '../hooks/useTokenDetail';

export function MobileLayout({ disableTrade }: { disableTrade?: boolean }) {
  const { tokenAddress, networkId, tokenDetail, isNative, websocketConfig } =
    useTokenDetail();
  const intl = useIntl();
  const { accountAddress } = useNetworkAccountAddress(networkId);
  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress,
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
                portfolioData={portfolioData}
                isRefreshing={isRefreshing}
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
    [
      height,
      isNative,
      informationHeader,
      renderInformationHeader,
      portfolioData,
      isRefreshing,
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

      {isNative ? null : (
        <SwapPanel
          swapToken={toSwapPanelToken}
          portfolioData={portfolioData}
          disableTrade={disableTrade}
          onShowSwapDialog={showSwapDialog}
        />
      )}
      {platformEnv.isNative && !disableTrade && !isNative ? (
        <SwapFlashBtn
          buttonProps={{
            style: { position: 'absolute', bottom: 100, right: 20 },
          }}
          onFlashTrade={() => showSwapDialog(toSwapPanelToken)}
        />
      ) : null}
    </YStack>
  );
}
