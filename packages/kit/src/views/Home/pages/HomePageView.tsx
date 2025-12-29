import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  Icon,
  Page,
  RefreshControl,
  ScrollView,
  Stack,
  Tabs,
  XStack,
  YStack,
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
import { TabPageHeader } from '../../../components/TabPageHeader';
import { WebDappEmptyView } from '../../../components/WebDapp/WebDappEmptyView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountOverviewActions,
  useApprovalsInfoAtom,
} from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { NetworkUnsupportedWarning } from '../../Staking/components/ProtocolDetails/NetworkUnsupportedWarning';
import { HomeSupportedWallet } from '../components/HomeSupportedWallet';
import { NotBackedUpEmpty } from '../components/NotBakcedUp';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';

import { ApprovalListContainerWithProvider } from './ApprovalListContainer';
import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainerWithProvider } from './NFTListContainer';
import { PortfolioContainerWithProvider } from './PortfolioContainer';
import { TabHeaderSettings } from './TabHeaderSettings';
import { TxHistoryListContainerWithProvider } from './TxHistoryContainer';
import WalletContentWithAuth from './WalletContentWithAuth';

import type { LayoutChangeEvent, ScrollViewProps } from 'react-native';

const networksSupportBulkRevokeApproval =
  getNetworksSupportBulkRevokeApproval();

interface IAndroidScrollContainerProps {
  children: React.ReactNode;
}
const AndroidScrollContainer = platformEnv.isNativeAndroid
  ? ({ children }: IAndroidScrollContainerProps) => {
      const [height, setHeight] = useState(0);
      const handleLayout = (event: LayoutChangeEvent) => {
        setHeight(event.nativeEvent.layout.height);
      };
      return (
        <YStack flex={1} onLayout={handleLayout}>
          {height > 0 ? (
            <ScrollView
              nestedScrollEnabled
              refreshControl={<PullToRefresh onRefresh={onHomePageRefresh} />}
              contentContainerStyle={{ height }}
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addressType = deriveInfo?.labelKey
    ? intl.formatMessage({
        id: deriveInfo?.labelKey,
      })
    : deriveInfo?.label ?? '';

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

  usePromiseResult(async () => {
    if (network?.id && account?.id) {
      const resp =
        await backgroundApiProxy.serviceApproval.fetchAccountApprovals({
          networkId: network.id,
          accountId: account.id,
          indexedAccountId: indexedAccount?.id,
          accountAddress: account.address,
        });

      const riskApprovals = resp.contractApprovals.filter(
        (item) => item.isRiskContract,
      );

      updateApprovalsInfo({
        hasRiskApprovals: !!(riskApprovals && riskApprovals.length > 0),
      });
    }
  }, [network?.id, indexedAccount?.id, account, updateApprovalsInfo]);

  const { vaultSettings, networkAccounts } = result.result ?? {};

  const isNFTEnabled =
    vaultSettings?.NFTEnabled &&
    networkUtils.getEnabledNFTNetworkIds().includes(network?.id ?? '');

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
    return <HomeHeaderContainer />;
  }, []);

  const tabContainerWidth: any = useTabContainerWidth();

  const tabConfigs = useMemo(() => {
    return [
      {
        id: EHomeWalletTab.Portfolio,
        name: intl.formatMessage({
          id: ETranslations.global_portfolio,
        }),
        component: <PortfolioContainerWithProvider />,
      },
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
      isBulkRevokeApprovalEnabled
        ? {
            id: EHomeWalletTab.Approvals,
            name: intl.formatMessage({
              id: ETranslations.global_approval,
            }),
            component: <ApprovalListContainerWithProvider />,
          }
        : undefined,
    ].filter(Boolean);
  }, [intl, isNFTEnabled, isBulkRevokeApprovalEnabled]);

  const handleRenderItem = useCallback(
    (props: ITabBarItemProps) => {
      const tabId = tabConfigs.find((i) => i.name === props.name)?.id;
      return (
        <XStack position="relative">
          <TabBarItem {...props} />
          {tabId === EHomeWalletTab.Approvals && hasRiskApprovals ? (
            <Stack
              position="absolute"
              right={-6}
              top={12}
              w="$1.5"
              h="$1.5"
              bg="$iconCritical"
              borderRadius="$full"
            />
          ) : null}
        </XStack>
      );
    },
    [hasRiskApprovals, tabConfigs],
  );

  const tabs = useMemo(() => {
    if (isWalletNotBackedUp) {
      return (
        <ScrollView h="100%">
          {renderHeader()}
          <NotBackedUpEmpty />
        </ScrollView>
      );
    }
    const key = `${account?.id ?? ''}-${account?.indexedAccountId ?? ''}-${
      network?.id ?? ''
    }-${isNFTEnabled ? '1' : '0'}-${isBulkRevokeApprovalEnabled ? '1' : '0'}`;
    return (
      <Tabs.Container
        ref={tabsRef as any}
        key={key}
        allowHeaderOverscroll
        width={tabContainerWidth}
        renderHeader={renderHeader}
        renderTabBar={(props: any) => (
          <Tabs.TabBar
            {...props}
            renderItem={handleRenderItem}
            renderToolbar={({ focusedTab }) => (
              <TabHeaderSettings focusedTab={focusedTab} />
            )}
          />
        )}
      >
        {tabConfigs.map((tab) => (
          <Tabs.Tab key={tab.name} name={tab.name}>
            {tab.component}
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    );
  }, [
    account?.id,
    account?.indexedAccountId,
    handleRenderItem,
    isBulkRevokeApprovalEnabled,
    isNFTEnabled,
    isWalletNotBackedUp,
    network?.id,
    renderHeader,
    tabConfigs,
    tabContainerWidth,
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
        <YStack height="100%">
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
        contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}
      >
        {platformEnv.isWebDappMode ? <WebDappEmptyView /> : <EmptyWallet />}
      </ScrollView>
    );

    if (wallet) {
      content = homePageContent;
      // This is a temporary hack solution, need to fix the layout of headerLeft and headerRight
    }
    return (
      <>
        <Page.Body>
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
              <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />
            </YStack>
          ) : null}
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
  ]);

  return useMemo(() => {
    const content = platformEnv.isNativeAndroid ? (
      <AndroidScrollContainer>{homePage}</AndroidScrollContainer>
    ) : (
      homePage
    );
    return <Page fullPage>{content}</Page>;
  }, [homePage]);
}
