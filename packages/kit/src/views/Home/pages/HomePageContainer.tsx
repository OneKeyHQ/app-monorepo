import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Easing, RefreshControl } from 'react-native';

import { Page, Stack, Tab, XStack, YStack } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import DAppConnectExtensionFloatingTrigger from '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { OnboardingOnMount } from '../../Onboarding/components';
import HomeSelector from '../components/HomeSelector';
import useHomePageWidth from '../hooks/useHomePageWidth';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';

let CONTENT_ITEM_WIDTH: Animated.Value | undefined;

function HomePage({ onPressHide }: { onPressHide: () => void }) {
  const { screenWidth, pageWidth } = useHomePageWidth();
  if (CONTENT_ITEM_WIDTH == null) {
    CONTENT_ITEM_WIDTH = new Animated.Value(pageWidth);
  }
  useEffect(() => {
    if (!CONTENT_ITEM_WIDTH) {
      return;
    }
    Animated.timing(CONTENT_ITEM_WIDTH, {
      toValue: pageWidth,
      duration: 400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pageWidth]);
  const intl = useIntl();
  const {
    activeAccount: { account, accountName, network, deriveInfo, wallet, ready },
  } = useActiveAccount({ num: 0 });
  const [isHide, setIsHide] = useState(false);

  const onRefresh = useCallback(() => {
    // tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const isNFTEnabled = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId: network?.id ?? '',
      }),
    [network],
  ).result?.NFTEnabled;

  const tabs = useMemo(
    () =>
      [
        {
          title: intl.formatMessage({
            id: 'asset__tokens',
          }),
          page: memo(TokenListContainerWithProvider, () => true),
        },
        isNFTEnabled
          ? {
              title: intl.formatMessage({
                id: 'asset__collectibles',
              }),
              page: memo(NFTListContainer, () => true),
            }
          : null,
        // {
        //   title: 'Defi',
        //   page: memo(DefiListContainer, () => true),
        // },
        {
          title: intl.formatMessage({
            id: 'transaction__history',
          }),
          page: memo(TxHistoryListContainer, () => true),
        },
      ].filter(Boolean),
    [intl, isNFTEnabled],
  );

  const headerLeft = useCallback(
    () =>
      isHide ? null : (
        <AccountSelectorProviderMirror
          enabledNum={[0]}
          config={{
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
          }}
        >
          <AccountSelectorTriggerHome num={0} />
        </AccountSelectorProviderMirror>
      ),
    [isHide],
  );

  const navigation = useAppNavigation();
  const scanQrCode = useScanQrCode();
  const openSettingPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  const onScanButtonPressed = useCallback(
    () => scanQrCode.start(),
    [scanQrCode],
  );

  const renderHeaderRight = useCallback(
    () => (
      <HeaderButtonGroup testID="Wallet-Page-Header-Right">
        <HeaderIconButton
          title="Scan"
          icon="ScanOutline"
          onPress={onScanButtonPressed}
        />
        {/* <HeaderIconButton title="Lock Now" icon="LockOutline" /> */}

        <HeaderIconButton
          title="Settings"
          icon="SettingsOutline"
          onPress={openSettingPage}
        />
      </HeaderButtonGroup>
    ),
    [openSettingPage, onScanButtonPressed],
  );

  const renderHomePage = useCallback(() => {
    if (!ready) return null;
    if (wallet) {
      // This is a temporary hack solution, need to fix the layout of headerLeft and headerRight
      return (
        <>
          <Page.Header
            headerShown={!platformEnv.isNative}
            headerLeft={headerLeft}
            headerRight={renderHeaderRight}
          />
          <Page.Body>
            {platformEnv.isNative && (
              <XStack
                justifyContent="space-between"
                px="$4"
                pt={platformEnv.isNativeIOS ? '$20' : 0}
              >
                <Stack flex={1}>{headerLeft()}</Stack>
                {renderHeaderRight()}
              </XStack>
            )}
            {/* {process.env.NODE_ENV !== 'production' ? (
              <Button
                onPress={async () => {
                  setIsHide((v) => !v);
                  await timerUtils.wait(1000);
                  onPressHide();
                }}
              >
                home-hide-test
              </Button>
            ) : null} */}
            {account ? (
              <Tab
                data={tabs}
                ListHeaderComponent={<HomeHeaderContainer />}
                initialScrollIndex={0}
                contentItemWidth={CONTENT_ITEM_WIDTH}
                contentWidth={screenWidth}
                refreshControl={
                  <RefreshControl refreshing={false} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <YStack height="100%">
                <HomeSelector padding="$5" />
                <Stack flex={1} justifyContent="center">
                  <EmptyAccount
                    name={accountName}
                    chain={network?.name ?? ''}
                    type={
                      (deriveInfo?.labelKey
                        ? intl.formatMessage({
                            id: deriveInfo?.labelKey,
                          })
                        : deriveInfo?.label) ?? ''
                    }
                  />
                </Stack>
              </YStack>
            )}
          </Page.Body>
        </>
      );
    }

    return (
      <Page.Body>
        <Stack h="100%" justifyContent="center">
          <EmptyWallet />
        </Stack>
      </Page.Body>
    );
  }, [
    ready,
    wallet,
    headerLeft,
    renderHeaderRight,
    account,
    tabs,
    screenWidth,
    onRefresh,
    accountName,
    network?.name,
    deriveInfo?.labelKey,
    deriveInfo?.label,
    intl,
  ]);

  return useMemo(() => <Page>{renderHomePage()}</Page>, [renderHomePage]);
}

function HomePageContainer() {
  const [isHide, setIsHide] = useState(false);
  console.log('HomePageContainer render');

  if (isHide) {
    return null;
  }
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomePage onPressHide={() => setIsHide((v) => !v)} />
      <DAppConnectExtensionFloatingTrigger />
      <OnboardingOnMount />
    </AccountSelectorProviderMirror>
  );
}

export default HomePageContainer;
