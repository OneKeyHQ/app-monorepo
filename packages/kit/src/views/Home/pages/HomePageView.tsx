import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { type LayoutChangeEvent } from 'react-native';

import {
  Icon,
  Page,
  ScrollView,
  Stack,
  Tabs,
  YStack,
  useTabContainerWidth,
} from '@onekeyhq/components';
import { getEnabledNFTNetworkIds } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import { NetworkAlert } from '../../../components/NetworkAlert';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { WalletBackupAlert } from '../../../components/WalletBackup';
import { WebDappEmptyView } from '../../../components/WebDapp/WebDappEmptyView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeSupportedWallet } from '../components/HomeSupportedWallet';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainerWithProvider } from './NFTListContainer';
import { TabHeaderSettings } from './TabHeaderSettings';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainerWithProvider } from './TxHistoryContainer';
import WalletContentWithAuth from './WalletContentWithAuth';

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

  const { vaultSettings, networkAccounts } = result.result ?? {};

  const isNFTEnabled =
    vaultSettings?.NFTEnabled &&
    getEnabledNFTNetworkIds().includes(network?.id ?? '');
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

  const tabs = useMemo(() => {
    const key = `${account?.id ?? ''}-${account?.indexedAccountId ?? ''}-${
      network?.id ?? ''
    }-${isNFTEnabled ? '1' : '0'}`;
    const tabConfigs = [
      {
        name: intl.formatMessage({
          id: ETranslations.global_crypto,
        }),
        component: <TokenListContainerWithProvider />,
      },
      isNFTEnabled
        ? {
            name: intl.formatMessage({
              id: ETranslations.global_nft,
            }),
            component: <NFTListContainerWithProvider />,
          }
        : undefined,
      {
        name: intl.formatMessage({
          id: ETranslations.global_history,
        }),
        component: <TxHistoryListContainerWithProvider />,
      },
    ].filter(Boolean);
    return (
      <Tabs.Container
        key={key}
        allowHeaderOverscroll
        width={tabContainerWidth}
        renderHeader={renderHeader}
        renderTabBar={(props: any) => (
          <Tabs.TabBar
            {...props}
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
    intl,
    isNFTEnabled,
    network?.id,
    renderHeader,
    tabContainerWidth,
  ]);

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
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, clearCache);
      appEventBus.off(EAppEventBusNames.AccountUpdate, clearCache);
      appEventBus.off(EAppEventBusNames.AddressBookUpdate, clearCache);
    };
  }, []);

  const homePageContent = useMemo(() => {
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
          {/* {
            // The upgrade reminder does not need to be displayed on the Url Account page
            sceneName === EAccountSelectorSceneName.home ? (
              <>
                <UpdateReminder />
                <HomeFirmwareUpdateReminder />
                <WalletXfpStatusReminder />
              </>
            ) : null
          } */}
          {content}
          <WalletBackupAlert />
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

  return useMemo(() => <Page fullPage>{homePage}</Page>, [homePage]);
}
