import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Page, Stack, Tabs, YStack } from '@onekeyhq/components';
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
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeSupportedWallet } from '../components/HomeSupportedWallet';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainerWithProvider } from './NFTListContainer';
import { TabHeaderSettings } from './TabHeaderSettings';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainerWithProvider } from './TxHistoryContainer';
import WalletContentWithAuth from './WalletContentWithAuth';

import type { LayoutChangeEvent } from 'react-native';

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

  const onRefresh = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
  }, []);

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

  const tabContainerProps = useMemo(() => {
    return {
      headerContainerStyle: {
        shadowOpacity: 0,
        elevation: 0,
      },
      renderHeader,
      renderTabBar: (props: any) => (
        <Tabs.TabBar
          {...props}
          renderToolbar={({ focusedTab }) => (
            <TabHeaderSettings focusedTab={focusedTab} />
          )}
        />
      ),
    };
  }, [renderHeader]);

  const tabs = useMemo(() => {
    const key = `${account?.id ?? ''}-${account?.indexedAccountId ?? ''}-${
      network?.id ?? ''
    }-${isNFTEnabled ? '1' : '0'}`;
    return isNFTEnabled ? (
      <Tabs.Container {...tabContainerProps} key={key}>
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.global_crypto,
          })}
        >
          <TokenListContainerWithProvider />
        </Tabs.Tab>
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.global_nft,
          })}
        >
          <NFTListContainerWithProvider />
        </Tabs.Tab>
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.global_history,
          })}
        >
          <TxHistoryListContainerWithProvider />
        </Tabs.Tab>
      </Tabs.Container>
    ) : (
      <Tabs.Container {...tabContainerProps} key={key}>
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.global_crypto,
          })}
        >
          <TokenListContainerWithProvider />
        </Tabs.Tab>
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.global_history,
          })}
        >
          <TxHistoryListContainerWithProvider />
        </Tabs.Tab>
      </Tabs.Container>
    );
  }, [
    account?.id,
    account?.indexedAccountId,
    intl,
    isNFTEnabled,
    network?.id,
    tabContainerProps,
  ]);

  useEffect(() => {
    void Icon.prefetch('CloudOffOutline');
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
      <Stack h="100%" justifyContent="center">
        <EmptyWallet />
      </Stack>
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
