import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Easing, RefreshControl, StyleSheet } from 'react-native';

import { Image, Page, Stack, Tab, XStack, YStack } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { OnboardingOnMount } from '../../Onboarding/components';
import { EModalSettingRoutes } from '../../Setting/router/types';
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
      duration: 350,
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
  const openSettingPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);

  const renderHeaderRight = useCallback(
    () => (
      <HeaderButtonGroup testID="Wallet-Page-Header-Right">
        {/* <HeaderIconButton title="Scan" icon="ScanOutline" />
        <HeaderIconButton title="Lock Now" icon="LockOutline" /> */}

        <HeaderIconButton
          title="Scan"
          icon="SettingsOutline"
          onPress={openSettingPage}
        />
      </HeaderButtonGroup>
    ),
    [],
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
              <XStack justifyContent="space-between" px="$4" pt="$20">
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

function DappConnectExtensionPanel() {
  const { result } = usePromiseResult(
    () =>
      new Promise<{
        showFloatingButton: boolean;
        connectedAccount: IConnectionAccountInfoWithNum[] | null;
        faviconUrl: string | undefined;
      } | null>((resolve) => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          async (tabs) => {
            if (tabs[0]) {
              try {
                const currentOrigin = new URL(tabs[0]?.url ?? '').origin;
                const connectedAccount =
                  await backgroundApiProxy.serviceDApp.getAllConnectedAccountsByOrigin(
                    currentOrigin,
                  );
                resolve({
                  showFloatingButton: (connectedAccount ?? []).length > 0,
                  connectedAccount,
                  faviconUrl: tabs[0].favIconUrl,
                });
                return;
              } catch (error) {
                console.error('DappConnectExtensionPanel error:', error);
                resolve(null);
                return;
              }
            }
            resolve(null);
          },
        );
      }),
    [],
  );
  if (!result?.showFloatingButton) {
    return null;
  }

  return (
    <Stack
      position="absolute"
      bottom="$2"
      right="$2"
      h="$14"
      w="$14"
      space="$2"
      alignItems="center"
      justifyContent="center"
      bg="$bgApp"
      borderRadius="$3"
      shadowOffset={{
        width: 0,
        height: 12,
      }}
      shadowRadius={24}
      shadowColor="rgba(0, 0, 0, 0.09)"
    >
      <Image
        size="$10"
        borderRadius="$2"
        source={{
          uri: result?.faviconUrl,
        }}
      />
    </Stack>
  );
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
      <DappConnectExtensionPanel />
      <OnboardingOnMount />
    </AccountSelectorProviderMirror>
  );
}

export default HomePageContainer;
