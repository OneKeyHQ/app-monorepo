import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  NativeHomeTabs,
  Page,
  Stack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type {
  IHomeNativeRowEvent,
  IHomeNativeSchema,
  INativeHomeTabsRef,
} from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkAlert } from '../../../components/NetworkAlert';
import { RiskApprovalAlert } from '../../../components/RiskApprovalAlert';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { WatchOnlyAlert } from '../../../components/WatchOnlyAlert';
import { useManageToken } from '../../../hooks/useManageToken';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { homePageContentMaxWidthSx } from './homePageContentMaxWidth';
import { useHomeNativeDeFiRows } from './useHomeNativeDeFiRows.native';
import { useHomeNativeHistoryRows } from './useHomeNativeHistoryRows.native';
import { useHomeNativeNftRows } from './useHomeNativeNftRows.native';
import { useHomeNativeTokenRows } from './useHomeNativeTokenRows.native';

import type { NativeSyntheticEvent } from 'react-native';

type IHomeNativePageViewProps = {
  onPressHide?: () => void;
  sceneName: EAccountSelectorSceneName;
};

type IHomeNativeRefreshEvent = {
  tabKey: string;
};

export function HomeNativePageView(props: IHomeNativePageViewProps) {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });

  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <HomeNativePageViewContent {...props} />
    </HomeTokenListProviderMirrorWrapper>
  );
}

function HomeNativePageViewContent({ sceneName }: IHomeNativePageViewProps) {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const nativeTabsRef = useRef<INativeHomeTabsRef>(null);
  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveType,
      vaultSettings: cachedVaultSettings,
    },
  } = useActiveAccount({ num: 0 });
  const { result: fetchedVaultSettings } = usePromiseResult(
    async () => {
      if (!network?.id) {
        return undefined;
      }
      return backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId: network.id,
      });
    },
    [network?.id],
    {
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );
  const vaultSettings = fetchedVaultSettings ?? cachedVaultSettings;
  const isNFTEnabled =
    network?.isAllNetworks ||
    (vaultSettings?.NFTEnabled &&
      networkUtils.getEnabledNFTNetworkIds().includes(network?.id ?? ''));
  const { result: isDeFiEnabled = true } = usePromiseResult(
    async () => {
      if (!network?.id) {
        return false;
      }
      if (networkUtils.isAllNetwork({ networkId: network.id })) {
        return true;
      }
      const enabledNetworks =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();
      return !!enabledNetworks[network.id];
    },
    [network?.id],
    {
      initResult: true,
      swrKey: network?.id ? swrKeys.defiEnabled(network.id) : undefined,
    },
  );
  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });
  const canManageTokenNative = manageTokenEnabled && !!deriveType;
  const {
    handleTokenRowPress,
    isRefreshing: isPortfolioRefreshing,
    refreshNativeTokens,
    tokenRows,
  } = useHomeNativeTokenRows();
  const {
    deFiRows,
    handleDeFiRowPress,
    isRefreshing: isDeFiRefreshing,
    refreshNativeDeFi,
  } = useHomeNativeDeFiRows({
    enabled: !!isDeFiEnabled,
  });
  const {
    handleNftRowPress,
    isRefreshing: isNftRefreshing,
    nftRows,
    refreshNativeNFTs,
  } = useHomeNativeNftRows({
    enabled: !!isNFTEnabled,
  });
  const {
    handleHistoryRowPress,
    historyRows,
    isRefreshing: isHistoryRefreshing,
    refreshNativeHistory,
  } = useHomeNativeHistoryRows();

  const schema = useMemo<IHomeNativeSchema>(
    () => ({
      version: 1 as const,
      schemaId: 'home-native-shell-v2',
      activeTabKey: 'portfolio',
      tabs: [
        {
          key: 'portfolio',
          title: intl.formatMessage({
            id: ETranslations.dexmarket_spot,
          }),
          enabled: true,
        },
        {
          key: 'defi',
          title: intl.formatMessage({
            id: ETranslations.global_earn,
          }),
          enabled: !!isDeFiEnabled,
        },
        {
          key: 'nft',
          title: intl.formatMessage({
            id: ETranslations.global_nft,
          }),
          enabled: !!isNFTEnabled,
        },
        {
          key: 'history',
          title: intl.formatMessage({
            id: ETranslations.global_history,
          }),
          enabled: true,
        },
      ],
      rowsByTab: {
        portfolio: tokenRows,
        defi: deFiRows,
        nft: nftRows,
        history: historyRows,
      },
      refreshingByTab: {
        portfolio: isPortfolioRefreshing,
        defi: isDeFiRefreshing,
        nft: isNftRefreshing,
        history: isHistoryRefreshing,
      },
      hasMoreByTab: {},
      tabBar: {
        variant: 'pill',
        showSettingsButton: canManageTokenNative,
      },
    }),
    [
      canManageTokenNative,
      deFiRows,
      historyRows,
      intl,
      isDeFiRefreshing,
      isDeFiEnabled,
      isHistoryRefreshing,
      isNFTEnabled,
      isNftRefreshing,
      isPortfolioRefreshing,
      nftRows,
      tokenRows,
    ],
  );

  const handleRefresh = useCallback(
    (event: NativeSyntheticEvent<IHomeNativeRefreshEvent>) => {
      defaultLogger.account.wallet.walletPullToRefresh();
      const { tabKey } = event.nativeEvent;
      if (tabKey === 'portfolio') {
        void refreshNativeTokens().finally(() => {
          nativeTabsRef.current?.endRefreshing(tabKey);
        });
        return;
      }
      if (tabKey === 'defi') {
        void refreshNativeDeFi().finally(() => {
          nativeTabsRef.current?.endRefreshing(tabKey);
        });
        return;
      }
      if (tabKey === 'nft') {
        void refreshNativeNFTs().finally(() => {
          nativeTabsRef.current?.endRefreshing(tabKey);
        });
        return;
      }
      if (tabKey === 'history') {
        void refreshNativeHistory().finally(() => {
          nativeTabsRef.current?.endRefreshing(tabKey);
        });
        return;
      }
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
      nativeTabsRef.current?.endRefreshing(tabKey);
    },
    [
      refreshNativeDeFi,
      refreshNativeHistory,
      refreshNativeNFTs,
      refreshNativeTokens,
    ],
  );

  const handleRowPress = useCallback(
    (event: NativeSyntheticEvent<IHomeNativeRowEvent>) => {
      const { rowKey, rowType } = event.nativeEvent;
      if (rowType === 'token') {
        handleTokenRowPress(rowKey);
      } else if (rowType === 'defi') {
        handleDeFiRowPress(rowKey);
      } else if (rowType === 'nft') {
        handleNftRowPress(rowKey);
      } else if (rowType === 'history') {
        void handleHistoryRowPress(rowKey);
      }
    },
    [
      handleDeFiRowPress,
      handleHistoryRowPress,
      handleNftRowPress,
      handleTokenRowPress,
    ],
  );

  const handleRowAction = useCallback(
    (event: NativeSyntheticEvent<IHomeNativeRowEvent>) => {
      const { rowKey, tabKey } = event.nativeEvent;
      if (
        rowKey === 'tabBar:settings' &&
        tabKey === 'portfolio' &&
        canManageTokenNative
      ) {
        handleOnManageToken();
      }
    },
    [canManageTokenNative, handleOnManageToken],
  );

  const handleNativeError = useCallback(
    (event: NativeSyntheticEvent<{ code: string; message: string }>) => {
      console.error(event.nativeEvent);
    },
    [],
  );

  return (
    <Page fullPage>
      <Page.Body>
        <Page.Container flex={1} padded={false}>
          <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />
          <Stack {...homePageContentMaxWidthSx}>
            <RiskApprovalAlert />
            <WatchOnlyAlert />
            <NetworkAlert />
          </Stack>
          <NativeHomeTabs
            ref={nativeTabsRef}
            schema={schema}
            bottomInset={tabBarHeight}
            enableHorizontalSwipe
            onNativeError={handleNativeError}
            onRefresh={handleRefresh}
            onRowAction={handleRowAction}
            onRowPress={handleRowPress}
          >
            <NativeHomeTabs.Header>
              <Stack {...homePageContentMaxWidthSx}>
                <HomeHeaderContainer />
              </Stack>
            </NativeHomeTabs.Header>
          </NativeHomeTabs>
        </Page.Container>
      </Page.Body>
    </Page>
  );
}
