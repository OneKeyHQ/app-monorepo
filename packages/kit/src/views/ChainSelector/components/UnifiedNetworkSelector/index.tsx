import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  HeaderIconButton,
  Page,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import { EChainSelectorPages as EChainSelectorPagesEnum } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../../states/jotai/contexts/accountSelector';
import { NetworkContent } from './NetworkContent';
import PortfolioContent from './PortfolioContent';
import { TabSwitcher } from './TabSwitcher';

import type { IServerNetworkMatch } from '../../types';
import type { ITabType } from './TabSwitcher';
import type { RouteProp } from '@react-navigation/core';

function UnifiedNetworkSelector() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { createAddress } = useAccountSelectorCreateAddress();
  const actions = useAccountSelectorActions();

  const route =
    useRoute<
      RouteProp<
        IChainSelectorParamList,
        EChainSelectorPages.UnifiedNetworkSelector
      >
    >();

  const {
    num,
    sceneName,
    networkIds,
    recordNetworkHistoryEnabled,
    onNetworksChanged,
    defaultTab,
  } = route.params;

  const {
    activeAccount: {
      network: activeNetwork,
      account,
      wallet,
      indexedAccount,
    },
  } = useActiveAccount({ num });

  const walletId = wallet?.id ?? '';
  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const networkId = activeNetwork?.id;

  // Determine if tab switcher should be shown
  const showTabSwitcher = useMemo(() => {
    // Other Wallet doesn't support Portfolio tab
    if (accountUtils.isOthersWallet({ walletId })) {
      return false;
    }
    // Single network mode - no tab switcher
    if (defaultTab === 'network' && !networkUtils.isAllNetwork({ networkId })) {
      return false;
    }
    return true;
  }, [walletId, defaultTab, networkId]);

  // Determine initial tab
  const initialTab = useMemo((): ITabType => {
    if (accountUtils.isOthersWallet({ walletId })) {
      return 'network';
    }
    if (networkUtils.isAllNetwork({ networkId })) {
      return 'portfolio';
    }
    return defaultTab ?? 'network';
  }, [walletId, networkId, defaultTab]);

  const [activeTab, setActiveTab] = useState<ITabType>(initialTab);

  // Portfolio tab state (from AllNetworksManager)
  const [networksState, setNetworksState] = useState<{
    enabledNetworks: Record<string, boolean>;
    disabledNetworks: Record<string, boolean>;
  }>({
    enabledNetworks: {},
    disabledNetworks: {},
  });

  const [networks, setNetworks] = useState<{
    allNetworks: IServerNetworkMatch[];
    mainNetworks: IServerNetworkMatch[];
    frequentlyUsedNetworks: IServerNetworkMatch[];
  }>({
    allNetworks: [],
    mainNetworks: [],
    frequentlyUsedNetworks: [],
  });

  const enabledNetworksInit = useRef(false);

  const [originalEnabledNetworks, setOriginalEnabledNetworks] = useState<
    IServerNetworkMatch[]
  >([]);
  const [enabledNetworks, setEnabledNetworks] = useState<IServerNetworkMatch[]>(
    [],
  );

  const [isCreatingMissingAddresses, setIsCreatingMissingAddresses] =
    useState(false);

  const [isCreatingEnabledAddresses, setIsCreatingEnabledAddresses] =
    useState(false);

  const [searchKey, setSearchKey] = useState('');

  const [enabledNetworksWithoutAccount, setEnabledNetworksWithoutAccount] =
    useState<
      {
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }[]
    >([]);

  // Update enabled networks when state changes
  useEffect(() => {
    const result = networks.mainNetworks.filter((network) =>
      isEnabledNetworksInAllNetworks({
        networkId: network.id,
        enabledNetworks: networksState.enabledNetworks,
        disabledNetworks: networksState.disabledNetworks,
        isTestnet: network.isTestnet,
      }),
    );
    setEnabledNetworks(result);
    if (!enabledNetworksInit.current && networks.allNetworks.length > 0) {
      setOriginalEnabledNetworks(result);
      enabledNetworksInit.current = true;
    }
  }, [networksState, networks.mainNetworks, networks.allNetworks]);

  // Load networks data for portfolio tab
  usePromiseResult(async () => {
    const [allNetworksState, { networks: allNetworks }] = await Promise.all([
      backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
      backgroundApiProxy.serviceNetwork.getAllNetworks(),
    ]);
    setNetworksState({
      enabledNetworks: allNetworksState.enabledNetworks,
      disabledNetworks: allNetworksState.disabledNetworks,
    });

    const compatibleNetworks =
      await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
        {
          accountId,
          walletId,
          networkIds: allNetworks.map((network) => network.id),
          excludeTestNetwork: true,
        },
      );
    setNetworks({
      allNetworks,
      mainNetworks: compatibleNetworks.mainnetItems,
      frequentlyUsedNetworks: compatibleNetworks.frequentlyUsedItems,
    });
  }, [accountId, walletId]);

  // Network tab callbacks
  const handleNetworkPressItem = useCallback(
    (item: IServerNetwork) => {
      if (
        sceneName === EAccountSelectorSceneName.home ||
        sceneName === EAccountSelectorSceneName.homeUrlAccount
      ) {
        // Log network switch if needed
      }

      if (recordNetworkHistoryEnabled && activeNetwork) {
        void backgroundApiProxy.serviceNetwork.updateRecentNetwork({
          networkId: activeNetwork.id,
        });
      }

      void actions.current.updateSelectedAccountNetwork({
        num,
        networkId: item.id,
      });

      navigation.popStack();
    },
    [
      actions,
      num,
      navigation,
      recordNetworkHistoryEnabled,
      activeNetwork,
      sceneName,
    ],
  );

  const handleAddCustomNetwork = useCallback(() => {
    navigation.push(EChainSelectorPagesEnum.AddCustomNetwork, {
      state: 'add',
      onSuccess: (network: IServerNetwork) => {
        handleNetworkPressItem(network);
      },
    });
  }, [navigation, handleNetworkPressItem]);

  const handleEditCustomNetwork = useCallback(
    async (network: IServerNetwork) => {
      const rpcInfo =
        await backgroundApiProxy.serviceCustomRpc.getCustomRpcForNetwork(
          network.id,
        );
      navigation.push(EChainSelectorPagesEnum.AddCustomNetwork, {
        state: 'edit',
        networkId: network.id,
        networkName: network.name,
        rpcUrl: rpcInfo?.rpc ?? '',
        chainId: network.chainId,
        symbol: network.symbol,
        blockExplorerUrl: network.explorerURL,
        onSuccess: () => {
          // Refresh will be handled by event bus
        },
        onDeleteSuccess: () => {
          navigation.pop();
        },
      });
    },
    [navigation],
  );

  // Portfolio tab done handler
  const handlePortfolioDone = useCallback(async () => {
    setIsCreatingEnabledAddresses(true);

    const { accountsInfo } =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: accountId ?? '',
        indexedAccountId,
        networkId: getNetworkIdsMap().onekeyall,
        deriveType: undefined,
        excludeTestNetwork: true,
      });

    const networkAccountMap: Record<string, IAllNetworkAccountInfo> = {};
    for (let i = 0; i < accountsInfo.length; i += 1) {
      const item = accountsInfo[i];
      const { networkId: itemNetworkId, deriveType, dbAccount } = item;
      if (dbAccount) {
        networkAccountMap[`${itemNetworkId}_${deriveType ?? ''}`] = item;
      }
    }

    const enabledNetworksWithoutAccountTemp: {
      networkId: string;
      deriveType: IAccountDeriveTypes;
    }[] = [];

    for (let i = 0; i < enabledNetworks.length; i += 1) {
      const network = enabledNetworks[i];

      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: network.id,
        });

      const networkAccount = networkAccountMap[`${network.id}_${deriveType}`];
      if (!networkAccount) {
        enabledNetworksWithoutAccountTemp.push({
          networkId: network.id,
          deriveType,
        });
      }
    }

    setEnabledNetworksWithoutAccount(enabledNetworksWithoutAccountTemp);

    if (enabledNetworksWithoutAccountTemp.length > 0) {
      try {
        await createAddress({
          num: 0,
          account: {
            walletId,
            networkId: getNetworkIdsMap().onekeyall,
            indexedAccountId,
            deriveType: 'default',
          },
          customNetworks: enabledNetworksWithoutAccountTemp,
        });
      } catch (error) {
        setIsCreatingEnabledAddresses(false);
        throw error;
      }
    }

    await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
      enabledNetworks: networksState.enabledNetworks,
      disabledNetworks: networksState.disabledNetworks,
    });

    appEventBus.emit(EAppEventBusNames.EnabledNetworksChanged, undefined);

    navigation.pop();

    void onNetworksChanged?.();

    setIsCreatingEnabledAddresses(false);
  }, [
    accountId,
    createAddress,
    enabledNetworks,
    indexedAccountId,
    navigation,
    networksState.disabledNetworks,
    networksState.enabledNetworks,
    onNetworksChanged,
    walletId,
  ]);

  // Header title renderer
  const renderHeaderTitle = useCallback(() => {
    if (showTabSwitcher) {
      return <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />;
    }

    // Show simple title for network-only mode
    return (
      <YStack>
        <SizableText
          size="$headingLg"
          {...(platformEnv.isNativeIOS && {
            textAlign: 'center',
          })}
        >
          {intl.formatMessage({ id: ETranslations.global_networks })}
        </SizableText>
      </YStack>
    );
  }, [showTabSwitcher, activeTab, intl]);

  // Header right button
  const renderHeaderRight = useCallback(
    () => (
      <HeaderIconButton
        icon="PlusLargeSolid"
        onPress={handleAddCustomNetwork}
        title={intl.formatMessage({
          id: ETranslations.custom_network_add_network_action_text,
        })}
      />
    ),
    [handleAddCustomNetwork, intl],
  );

  // Portfolio footer button text
  const confirmButtonText = useMemo(() => {
    if (
      isCreatingEnabledAddresses &&
      enabledNetworksWithoutAccount.length > 0
    ) {
      return intl.formatMessage({
        id: ETranslations.global_creating_address,
      });
    }

    if (enabledNetworks.length > 0) {
      return `${intl.formatMessage({
        id: ETranslations.global_done,
      })} (${enabledNetworks.length}/${networks.mainNetworks.length})`;
    }

    return intl.formatMessage({
      id: ETranslations.network_none_selected,
    });
  }, [
    isCreatingEnabledAddresses,
    enabledNetworksWithoutAccount.length,
    enabledNetworks.length,
    intl,
    networks.mainNetworks.length,
  ]);

  // Check if done button should be disabled
  const isConfirmDisabled = useMemo(() => {
    if (enabledNetworks.length <= 0) {
      return true;
    }
    if (isCreatingEnabledAddresses || isCreatingMissingAddresses) {
      return true;
    }

    if (
      enabledNetworks.length === originalEnabledNetworks.length &&
      enabledNetworks.every((network) =>
        originalEnabledNetworks.find((item) => item.id === network.id),
      )
    ) {
      return true;
    }
    return false;
  }, [
    enabledNetworks,
    isCreatingEnabledAddresses,
    isCreatingMissingAddresses,
    originalEnabledNetworks,
  ]);

  return (
    <Page
      safeAreaEnabled
      onClose={() => {
        if (networkUtils.isAllNetwork({ networkId })) {
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        }
      }}
    >
      <Page.Header
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
      />
      <Page.Body>
        {activeTab === 'portfolio' ? (
          <PortfolioContent
            walletId={walletId}
            accountId={accountId}
            indexedAccountId={indexedAccountId}
            networksState={networksState}
            setNetworksState={setNetworksState}
            enabledNetworks={enabledNetworks}
            searchKey={searchKey}
            setSearchKey={setSearchKey}
            isCreatingEnabledAddresses={isCreatingEnabledAddresses}
            setIsCreatingEnabledAddresses={setIsCreatingEnabledAddresses}
            isCreatingMissingAddresses={isCreatingMissingAddresses}
            setIsCreatingMissingAddresses={setIsCreatingMissingAddresses}
            networks={networks}
          />
        ) : (
          <NetworkContent
            walletId={walletId}
            accountId={accountId}
            indexedAccountId={indexedAccountId}
            networkId={networkId}
            networkIds={networkIds}
            onPressItem={handleNetworkPressItem}
            onAddCustomNetwork={handleAddCustomNetwork}
            onEditCustomNetwork={handleEditCustomNetwork}
          />
        )}
      </Page.Body>
      {activeTab === 'portfolio' && (
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={confirmButtonText}
            confirmButtonProps={{
              loading: isCreatingEnabledAddresses,
              disabled: isConfirmDisabled,
            }}
            onConfirm={handlePortfolioDone}
          />
        </Page.Footer>
      )}
    </Page>
  );
}

const UnifiedNetworkSelectorMemo = memo(UnifiedNetworkSelector);

export default function UnifiedNetworkSelectorPage() {
  const route =
    useRoute<
      RouteProp<
        IChainSelectorParamList,
        EChainSelectorPages.UnifiedNetworkSelector
      >
    >();

  const { num, sceneName, sceneUrl } = route.params;

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: sceneName ?? EAccountSelectorSceneName.home,
        sceneUrl: sceneUrl ?? '',
      }}
      enabledNum={[num]}
    >
      <UnifiedNetworkSelectorMemo />
    </AccountSelectorProviderMirror>
  );
}
