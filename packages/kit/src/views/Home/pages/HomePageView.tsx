import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { CanceledError } from 'axios';
import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  Icon,
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  Page,
  ScrollView,
  Stack,
  Tabs,
  YStack,
  useScrollContentTabBarOffset,
  useTabContainerWidth,
} from '@onekeyhq/components';
import type { ITabBarItemProps } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { TabBarItem } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import { NetworkAlert } from '../../../components/NetworkAlert';
import { RiskApprovalAlert } from '../../../components/RiskApprovalAlert';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { WebDappEmptyView } from '../../../components/WebDapp/WebDappEmptyView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { runAfterTokensDone } from '../../../hooks/useRunAfterTokensDone';
import {
  useAccountOverviewActions,
  useApprovalsInfoAtom,
} from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { deferHeavyWorkUntilUIIdle } from '../../../utils/deferHeavyWork';
import { NetworkUnsupportedWarning } from '../../Staking/components/ProtocolDetails/NetworkUnsupportedWarning';
import { HomeSupportedWallet } from '../components/HomeSupportedWallet';
import { NotBackedUpEmpty } from '../components/NotBakcedUp';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';

import { DeFiContainerWithProvider } from './DeFiContainer';
import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainerWithProvider } from './NFTListContainer';
import { PortfolioContainerWithProvider } from './PortfolioContainer';
import { TabHeaderSettings } from './TabHeaderSettings';
import { TxHistoryListContainerWithProvider } from './TxHistoryContainer';
import WalletContentWithAuth from './WalletContentWithAuth';

import type { LayoutChangeEvent } from 'react-native';

const networksSupportBulkRevokeApproval =
  getNetworksSupportBulkRevokeApproval();

interface IAndroidScrollContainerProps {
  children: React.ReactNode;
}
const AndroidScrollContainer = platformEnv.isNativeAndroid
  ? ({ children }: IAndroidScrollContainerProps) => {
      const [height, setHeight] = useState(0);
      const heightRef = useRef(0);
      const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const h = Math.round(event.nativeEvent.layout.height);
        if (h !== heightRef.current) {
          heightRef.current = h;
          setHeight(h);
        }
      }, []);
      const contentContainerStyle = useMemo(() => ({ height }), [height]);
      return (
        <YStack flex={1} onLayout={handleLayout}>
          {height > 0 ? (
            <ScrollView
              nestedScrollEnabled
              refreshControl={<PullToRefresh onRefresh={onHomePageRefresh} />}
              contentContainerStyle={contentContainerStyle}
            >
              {children}
            </ScrollView>
          ) : null}
        </YStack>
      );
    }
  : ({ children }: IAndroidScrollContainerProps) => {
      return children;
    };

export function HomePageView({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPressHide,
  sceneName,
}: {
  onPressHide?: () => void;
  sceneName: EAccountSelectorSceneName;
}) {
  const tabBarHeight = useScrollContentTabBarOffset();
  const tabContainerWidth = useTabContainerWidth();
  const intl = useIntl();
  const {
    activeAccount: {
      account,
      accountName,
      network,
      deriveInfo,
      wallet,
      ready,
      device,
      indexedAccount,
    },
  } = useActiveAccount({ num: 0 });

  const [{ hasRiskApprovals }] = useApprovalsInfoAtom();
  const { updateApprovalsInfo } = useAccountOverviewActions().current;
  const tabsRef = useRef<ITabContainerRef | null>(null);

  // Force PagerView to re-sync after bottom tab switch (freeze/unfreeze)
  const wasBlurredRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let idleHandle: ReturnType<typeof requestIdleCallback> | undefined;
      if (wasBlurredRef.current && tabsRef.current) {
        // Force PagerView to display the correct page after freeze/unfreeze.
        // Defer until JS thread is idle to avoid blocking the first render
        // frame after tab switch, which causes black screen flicker.
        idleHandle = requestIdleCallback(() => {
          tabsRef.current?.syncCurrentPage();
        });
      }
      return () => {
        if (idleHandle !== undefined) {
          cancelIdleCallback(idleHandle);
        }
        wasBlurredRef.current = true;
      };
    }, []),
  );

  const hasRiskApprovalsRef = useRef(hasRiskApprovals);
  useEffect(() => {
    hasRiskApprovalsRef.current = hasRiskApprovals;
  }, [hasRiskApprovals]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addressType = deriveInfo?.labelKey
    ? intl.formatMessage({
        id: deriveInfo?.labelKey,
      })
    : (deriveInfo?.label ?? '');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isHide, setIsHide] = useState(false);

  const result = usePromiseResult(async () => {
    if (!network) {
      return;
    }
    const [v, a] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId: network?.id ?? '',
      }),
      indexedAccount
        ? backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId: network?.id ?? '',
              indexedAccountId: indexedAccount?.id ?? '',
              excludeEmptyAccount: true,
            },
          )
        : undefined,
    ]);
    return {
      vaultSettings: v,
      networkAccounts: a,
    };
  }, [network, indexedAccount]);

  const { vaultSettings, networkAccounts } = result.result ?? {};

  const isNFTEnabled =
    vaultSettings?.NFTEnabled &&
    networkUtils.getEnabledNFTNetworkIds().includes(network?.id ?? '');

  const [isDeFiEnabled, setIsDeFiEnabled] = useState(true);
  useEffect(() => {
    const checkDeFiEnabled = async () => {
      if (!network?.id) {
        setIsDeFiEnabled(false);
        return;
      }
      if (networkUtils.isAllNetwork({ networkId: network.id })) {
        setIsDeFiEnabled(true);
        return;
      }
      const enabledNetworks =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();
      setIsDeFiEnabled(!!enabledNetworks[network.id]);
    };
    void checkDeFiEnabled();
  }, [network?.id]);

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  const isBulkRevokeApprovalEnabled = useMemo(() => {
    if (network?.isAllNetworks) {
      if (
        accountUtils.isOthersAccount({
          accountId: account?.id ?? '',
        })
      ) {
        return networkUtils.isEvmNetwork({
          networkId: account?.createAtNetwork ?? '',
        });
      }
      return true;
    }

    return networksSupportBulkRevokeApproval[network?.id ?? ''] ?? false;
  }, [
    network?.isAllNetworks,
    network?.id,
    account?.id,
    account?.createAtNetwork,
  ]);

  useEffect(() => {
    let cancelled = false;

    // Keep the red-dot state from becoming stale across account/network switches.
    if (hasRiskApprovalsRef.current) {
      updateApprovalsInfo({ hasRiskApprovals: false, riskApprovalsCount: 0 });
    }

    const run = async (_trigger: string) => {
      if (!isBulkRevokeApprovalEnabled) return;
      if (!account?.id || !network?.id) return;

      await deferHeavyWorkUntilUIIdle();
      if (cancelled) return;

      try {
        const resp =
          await backgroundApiProxy.serviceApproval.fetchAccountApprovals({
            networkId: network.id,
            accountId: account.id,
            indexedAccountId: indexedAccount?.id,
            accountAddress: account.address,
          });
        if (cancelled) return;
        const riskApprovals = resp.contractApprovals.filter(
          (i) => i.isRiskContract,
        );
        updateApprovalsInfo({
          hasRiskApprovals: riskApprovals.length > 0,
          riskApprovalsCount: riskApprovals.length,
        });
      } catch (error) {
        if (error instanceof CanceledError) {
          return;
        }
        console.error(error);
      }
    };

    const cleanup = runAfterTokensDone({
      enabled: isBulkRevokeApprovalEnabled,
      fallbackDelayMs: 12_000,
      deferWhileRefreshing: true,
      retryDelayMs: 2000,
      maxWaitMs: 30_000,
      networkId: network?.id,
      matchNetworkId: true,
      onRun: run,
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [
    account?.address,
    account?.id,
    indexedAccount?.id,
    isBulkRevokeApprovalEnabled,
    network?.id,
    updateApprovalsInfo,
  ]);

  const isRequiredValidation = vaultSettings?.validationRequired;
  const softwareAccountDisabled = vaultSettings?.softwareAccountDisabled;
  const supportedDeviceTypes = vaultSettings?.supportedDeviceTypes;
  const watchingAccountEnabled = vaultSettings?.watchingAccountEnabled;

  const emptyAccountView = useMemo(
    () => (
      <EmptyAccount
        autoCreateAddress
        createAllDeriveTypes
        createAllEnabledNetworks
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
    ),
    [accountName, deriveInfo?.label, deriveInfo?.labelKey, intl, network?.name],
  );

  const renderHeader = useCallback(() => {
    return (
      <>
        <RiskApprovalAlert />
        <HomeHeaderContainer />
      </>
    );
  }, []);

  const tabConfigs = useMemo(() => {
    return [
      {
        id: EHomeWalletTab.Portfolio,
        name: intl.formatMessage({
          id: ETranslations.dexmarket_spot,
        }),
        component: <PortfolioContainerWithProvider />,
      },
      isDeFiEnabled
        ? {
            id: EHomeWalletTab.DeFi,
            name: intl.formatMessage({
              id: ETranslations.global_earn,
            }),
            component: <DeFiContainerWithProvider />,
          }
        : undefined,
      isNFTEnabled
        ? {
            id: EHomeWalletTab.NFT,
            name: intl.formatMessage({
              id: ETranslations.global_nft,
            }),
            component: <NFTListContainerWithProvider />,
          }
        : undefined,
      {
        id: EHomeWalletTab.History,
        name: intl.formatMessage({
          id: ETranslations.global_history,
        }),
        component: <TxHistoryListContainerWithProvider />,
      },
    ].filter(Boolean);
  }, [intl, isDeFiEnabled, isNFTEnabled]);

  const handleRenderItem = useCallback((props: ITabBarItemProps) => {
    return <TabBarItem {...props} />;
  }, []);

  const renderToolbar = useCallback(
    ({ focusedTab }: { focusedTab: string }) => (
      <TabHeaderSettings focusedTab={focusedTab} />
    ),
    [],
  );

  const renderTabBar = useCallback(
    (props: any) => (
      <Tabs.TabBar
        {...props}
        variant="pill"
        renderItem={handleRenderItem}
        renderToolbar={renderToolbar}
      />
    ),
    [handleRenderItem, renderToolbar],
  );

  const tabs = useMemo(() => {
    if (isWalletNotBackedUp) {
      return (
        <Keyboard.AwareScrollView
          style={{ flex: 1 }}
          nestedScrollEnabled={platformEnv.isNativeAndroid}
          contentContainerStyle={{ paddingBottom: tabBarHeight }}
          bottomOffset={KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET}
        >
          {renderHeader()}
          <NotBackedUpEmpty />
        </Keyboard.AwareScrollView>
      );
    }
    const key = `${account?.id ?? ''}-${account?.indexedAccountId ?? ''}-${
      network?.id ?? ''
    }-${isDeFiEnabled ? '1' : '0'}-${isNFTEnabled ? '1' : '0'}`;
    return (
      <Tabs.Container
        ref={tabsRef as any}
        key={key}
        allowHeaderOverscroll
        useNativeHeaderAnimation={platformEnv.isNativeAndroid}
        width={platformEnv.isNative ? (tabContainerWidth as number) : undefined}
        renderHeader={renderHeader}
        renderTabBar={renderTabBar}
      >
        {tabConfigs.map((tab) => (
          <Tabs.Tab key={tab.name} name={tab.name}>
            {tab.component}
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    );
  }, [
    tabBarHeight,
    tabContainerWidth,
    account?.id,
    account?.indexedAccountId,
    isDeFiEnabled,
    isNFTEnabled,
    isWalletNotBackedUp,
    network?.id,
    renderHeader,
    renderTabBar,
    tabConfigs,
  ]);

  const handleSwitchWalletHomeTab = useCallback(
    (payload: { id: EHomeWalletTab }) => {
      const name = tabConfigs.find((i) => i.id === payload.id)?.name;
      if (name) {
        tabsRef.current?.jumpToTab(name);
      }
    },
    [tabConfigs],
  );

  useEffect(() => {
    void Icon.prefetch('CloudOffOutline');
  }, []);

  useEffect(() => {
    const clearCache = async () => {
      await backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
    };

    appEventBus.on(EAppEventBusNames.WalletUpdate, clearCache);
    appEventBus.on(EAppEventBusNames.AccountUpdate, clearCache);
    appEventBus.on(EAppEventBusNames.AddressBookUpdate, clearCache);
    appEventBus.on(
      EAppEventBusNames.SwitchWalletHomeTab,
      handleSwitchWalletHomeTab,
    );
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, clearCache);
      appEventBus.off(EAppEventBusNames.AccountUpdate, clearCache);
      appEventBus.off(EAppEventBusNames.AddressBookUpdate, clearCache);
      appEventBus.off(
        EAppEventBusNames.SwitchWalletHomeTab,
        handleSwitchWalletHomeTab,
      );
    };
  }, [handleSwitchWalletHomeTab]);

  const { result: accountNetworkNotSupported } = usePromiseResult(
    async () => {
      if (!network?.id) return undefined;
      const checkResult =
        await backgroundApiProxy.serviceAccount.checkAccountNetworkNotSupported(
          {
            walletId: wallet?.id,
            accountId: account?.id,
            accountImpl: account?.impl,
            activeNetworkId: network.id,
            featuresInfoCache: device?.featuresInfo,
          },
        );

      return !!checkResult?.networkImpl;
    },
    [account?.id, account?.impl, wallet?.id, network?.id, device?.featuresInfo],
    { initResult: undefined },
  );

  const homePageContent = useMemo(() => {
    if (accountNetworkNotSupported) {
      return (
        <YStack height="100%">
          <Stack flex={1} justifyContent="center">
            <NetworkUnsupportedWarning
              networkId={network?.id ?? ''}
              emptyStyle
            />
          </Stack>
        </YStack>
      );
    }

    if (
      (softwareAccountDisabled &&
        accountUtils.isHdWallet({
          walletId: wallet?.id ?? '',
        })) ||
      (supportedDeviceTypes &&
        device?.deviceType &&
        !supportedDeviceTypes.includes(device?.deviceType))
    ) {
      return (
        <HomeSupportedWallet
          supportedDeviceTypes={supportedDeviceTypes}
          watchingAccountEnabled={watchingAccountEnabled}
        />
      );
    }

    if (
      !account &&
      !(
        vaultSettings?.mergeDeriveAssetsEnabled &&
        networkAccounts &&
        networkAccounts.networkAccounts &&
        networkAccounts.networkAccounts.length > 0
      )
    ) {
      return (
        <YStack flex={1}>
          <Stack flex={1} justifyContent="center">
            {emptyAccountView}
          </Stack>
        </YStack>
      );
    }

    if (isRequiredValidation) {
      return (
        <WalletContentWithAuth
          networkId={network?.id ?? ''}
          accountId={account?.id ?? ''}
        >
          <>{tabs}</>
        </WalletContentWithAuth>
      );
    }

    return tabs;
  }, [
    accountNetworkNotSupported,
    softwareAccountDisabled,
    wallet?.id,
    supportedDeviceTypes,
    device?.deviceType,
    account,
    vaultSettings?.mergeDeriveAssetsEnabled,
    networkAccounts,
    isRequiredValidation,
    watchingAccountEnabled,
    emptyAccountView,
    network?.id,
    tabs,
  ]);

  // Initial heights based on typical header sizes on each platform
  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS ? 143 : 92,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    // Use the actual measured height without arbitrary adjustments
    const height = e.nativeEvent.layout.height - 20;
    setTabPageHeight(height);
  }, []);

  const homePage = useMemo(() => {
    if (!ready) {
      return <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />;
    }

    let content = (
      <ScrollView
        h="100%"
        contentContainerStyle={{
          justifyContent: 'center',
          flexGrow: 1,
          pb: tabBarHeight,
        }}
      >
        {platformEnv.isWebDappMode ? <WebDappEmptyView /> : <EmptyWallet />}
      </ScrollView>
    );

    if (wallet) {
      content = platformEnv.isNative ? (
        <AndroidScrollContainer>{homePageContent}</AndroidScrollContainer>
      ) : (
        homePageContent
      );
      // This is a temporary hack solution, need to fix the layout of headerLeft and headerRight
    }
    return (
      <>
        <Page.Body>
          <Page.Container flex={1} padded={false}>
            {platformEnv.isNative ? (
              <Stack h={tabPageHeight} />
            ) : (
              <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />
            )}
            <NetworkAlert />
            {content}
            {platformEnv.isNative ? (
              <YStack
                position="absolute"
                top={-20}
                left={0}
                bg="$bgApp"
                pt="$5"
                width="100%"
                onLayout={handleTabPageLayout}
              >
                <TabPageHeader
                  sceneName={sceneName}
                  tabRoute={ETabRoutes.Home}
                />
              </YStack>
            ) : null}
          </Page.Container>
        </Page.Body>
      </>
    );
  }, [
    ready,
    wallet,
    tabPageHeight,
    sceneName,
    handleTabPageLayout,
    homePageContent,
    tabBarHeight,
  ]);

  return useMemo(() => {
    return <Page fullPage>{homePage}</Page>;
  }, [homePage]);
}
