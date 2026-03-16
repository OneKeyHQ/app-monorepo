import type { RefObject } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  HeaderIconButton,
  Page,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { PagerView } from '@onekeyhq/components/src/composite/Carousel/pager';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EChainSelectorPages,
  EChainSelectorPages as EChainSelectorPagesEnum,
  type IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useFindNetworksWithoutAccount } from '../../hooks/useFindNetworksWithoutAccount';

import { NetworkContent } from './NetworkContent';
import PortfolioContent from './PortfolioContent';
import { TabSwitcher } from './TabSwitcher';

import type { ITabType } from './TabSwitcher';
import type { IServerNetworkMatch } from '../../types';
import type { RouteProp } from '@react-navigation/core';
import type NativePagerView from 'react-native-pager-view';

const TAB_TO_INDEX: Record<ITabType, number> = { portfolio: 0, network: 1 };
const INDEX_TO_TAB: ITabType[] = ['portfolio', 'network'];

function UnifiedNetworkSelector() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { createAddress } = useAccountSelectorCreateAddress();
  const { findNetworksWithoutAccount } = useFindNetworksWithoutAccount();
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
    activeAccount: { network: activeNetwork, account, wallet, indexedAccount },
  } = useActiveAccount({ num });

  const walletId = wallet?.id ?? '';
  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const networkId = activeNetwork?.id;
  const isOthersWallet = accountUtils.isOthersWallet({ walletId });

  // Determine if tab switcher should be shown
  const showTabSwitcher = useMemo(() => {
    // Single network mode - no tab switcher
    if (defaultTab === 'network' && !networkUtils.isAllNetwork({ networkId })) {
      return false;
    }
    return true;
  }, [defaultTab, networkId]);

  // Determine initial tab
  const initialTab = useMemo((): ITabType => {
    if (networkUtils.isAllNetwork({ networkId })) {
      return 'portfolio';
    }
    if (isOthersWallet) {
      return 'network';
    }
    return defaultTab ?? 'network';
  }, [defaultTab, isOthersWallet, networkId]);

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

  const [missingAddressCount, setMissingAddressCount] = useState(0);

  const [isCreatingMissingAddresses, setIsCreatingMissingAddresses] =
    useState(false);

  const [isCreatingEnabledAddresses, setIsCreatingEnabledAddresses] =
    useState(false);

  const [searchKey, setSearchKey] = useState('');

  // Network values for portfolio tab
  const [accountNetworkValues, setAccountNetworkValues] = useState<
    Record<string, string>
  >({});
  const [accountNetworkValueCurrency, setAccountNetworkValueCurrency] =
    useState<string | undefined>(undefined);
  const [accountDeFiOverview, setAccountDeFiOverview] = useState<
    Record<string, { netWorth: number }>
  >({});

  const [_enabledNetworksWithoutAccount, setEnabledNetworksWithoutAccount] =
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

  // Use ref to track activeTab for closures (e.g. onSuccess in navigation)
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const pagerRef = useRef<NativePagerView>(null);

  const handleTabChange = useCallback((tab: ITabType) => {
    setActiveTab(tab);
    if (platformEnv.isNative) {
      pagerRef.current?.setPage(TAB_TO_INDEX[tab]);
    }
  }, []);

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const newTab = INDEX_TO_TAB[e.nativeEvent.position];
      if (newTab && newTab !== activeTabRef.current) {
        setActiveTab(newTab);
      }
    },
    [],
  );

  // Load networks data for portfolio tab
  const { run: refreshPortfolioData } = usePromiseResult(async () => {
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

    // Fetch network values for portfolio tab
    const [_accountsValue, _localDeFiOverview] = await Promise.all([
      backgroundApiProxy.serviceAccountProfile.getAllNetworkAccountsValue({
        accounts: [{ accountId: indexedAccountId ?? accountId ?? '' }],
      }),
      backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
        accounts: [
          {
            accountId: indexedAccountId ?? accountId ?? '',
            networkId: getNetworkIdsMap().onekeyall,
            indexedAccountId,
          },
        ],
        networksEnabledOnly: false,
      }),
    ]);

    if (_accountsValue[0] || _localDeFiOverview[0]) {
      const {
        formattedAccountNetworkValues,
        accountDeFiOverview: _accountDeFiOverview,
      } =
        await backgroundApiProxy.serviceNetwork.sortChainSelectorNetworksByValue(
          {
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: _accountsValue[0]?.accountId ?? '',
            }),
            chainSelectorNetworks: compatibleNetworks,
            accountNetworkValues: _accountsValue[0]?.value ?? {},
            localDeFiOverview: _localDeFiOverview[0]?.overview ?? {},
          },
        );

      setAccountNetworkValues(formattedAccountNetworkValues ?? {});
      setAccountNetworkValueCurrency(_accountsValue[0]?.currency);
      setAccountDeFiOverview(_accountDeFiOverview ?? {});
    }
  }, [accountId, walletId, indexedAccountId]);

  // Refresh portfolio data when a custom network is added
  useEffect(() => {
    const fn = async () => {
      try {
        // Use alwaysSetState to bypass the isFocused check, because this
        // event can fire while the navigation-back animation is still
        // running (screen not yet focused), which would silently skip
        // the refresh and leave stale data.
        await refreshPortfolioData({ alwaysSetState: true });
      } catch {
        // silently ignore refresh errors
      }
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, fn);
    };
  }, [refreshPortfolioData]);

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
      onSuccess: async (network: IServerNetwork) => {
        if (activeTabRef.current === 'portfolio') {
          // Portfolio tab: enable the new network and persist to backend.
          // Persist first to avoid race condition: refreshPortfolioData
          // (triggered by AddedCustomNetwork event) fetches backend state
          // and overwrites local state. By persisting before the event,
          // the backend already includes the enabled state.
          const newEnabledNetworks = {
            ...networksState.enabledNetworks,
            [network.id]: true,
          };
          const newDisabledNetworks = {
            ...networksState.disabledNetworks,
            [network.id]: false,
          };
          setNetworksState({
            enabledNetworks: newEnabledNetworks,
            disabledNetworks: newDisabledNetworks,
          });
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: newEnabledNetworks,
            disabledNetworks: newDisabledNetworks,
          });
          appEventBus.emit(EAppEventBusNames.AddedCustomNetwork, undefined);
        } else {
          // Network tab: select network and close modal (original behavior)
          handleNetworkPressItem(network);
        }
      },
    });
  }, [navigation, handleNetworkPressItem, networksState]);

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

  const isSameEnabledNetworks = useMemo(() => {
    return (
      enabledNetworks.length === originalEnabledNetworks.length &&
      enabledNetworks.every((network) =>
        originalEnabledNetworks.find((item) => item.id === network.id),
      )
    );
  }, [enabledNetworks, originalEnabledNetworks]);

  // Portfolio tab done handler
  const handlePortfolioDone = useCallback(async () => {
    setIsCreatingEnabledAddresses(true);
    try {
      if (!isOthersWallet) {
        // 1. Find networks missing addresses
        const networksWithoutAccount = await findNetworksWithoutAccount({
          accountId: accountId ?? '',
          indexedAccountId,
          enabledNetworks,
        });

        setEnabledNetworksWithoutAccount(networksWithoutAccount);

        // 2. Create missing addresses if any
        if (networksWithoutAccount.length > 0) {
          await createAddress({
            num: 0,
            account: {
              walletId,
              networkId: getNetworkIdsMap().onekeyall,
              indexedAccountId,
              deriveType: 'default',
            },
            customNetworks: networksWithoutAccount,
          });
        }
      } else {
        setEnabledNetworksWithoutAccount([]);
      }

      // 3. Save network state only when selection changed
      if (!isSameEnabledNetworks) {
        await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
          enabledNetworks: networksState.enabledNetworks,
          disabledNetworks: networksState.disabledNetworks,
        });

        appEventBus.emit(EAppEventBusNames.EnabledNetworksChanged, undefined);
      }

      // 4. Switch to All Networks if not already on it
      if (!networkUtils.isAllNetwork({ networkId })) {
        void backgroundApiProxy.serviceNetwork.updateRecentNetwork({
          networkId: getNetworkIdsMap().onekeyall,
        });

        void actions.current.updateSelectedAccountNetwork({
          num,
          networkId: getNetworkIdsMap().onekeyall,
        });
      }

      navigation.pop();

      void onNetworksChanged?.();
    } finally {
      setIsCreatingEnabledAddresses(false);
    }
  }, [
    accountId,
    actions,
    createAddress,
    enabledNetworks,
    findNetworksWithoutAccount,
    indexedAccountId,
    navigation,
    networkId,
    networksState.disabledNetworks,
    networksState.enabledNetworks,
    num,
    onNetworksChanged,
    walletId,
    isSameEnabledNetworks,
    isOthersWallet,
  ]);

  // Header title renderer
  const renderHeaderTitle = useCallback(() => {
    if (showTabSwitcher) {
      return (
        <TabSwitcher activeTab={activeTab} onTabChange={handleTabChange} />
      );
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
  }, [showTabSwitcher, activeTab, handleTabChange, intl]);

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
    if (isCreatingEnabledAddresses) {
      return intl.formatMessage({
        id: ETranslations.global_creating_address,
      });
    }

    if (enabledNetworks.length <= 0) {
      return intl.formatMessage({
        id: ETranslations.network_none_selected,
      });
    }

    if (missingAddressCount > 0) {
      return `${intl.formatMessage({
        id: ETranslations.global_create_address,
      })} & ${intl.formatMessage({
        id: ETranslations.global_apply,
      })}`;
    }

    return intl.formatMessage({
      id: ETranslations.global_done,
    });
  }, [
    isCreatingEnabledAddresses,
    enabledNetworks.length,
    missingAddressCount,
    intl,
  ]);

  // Check if done button should be disabled
  const isConfirmDisabled = useMemo(() => {
    if (enabledNetworks.length <= 0) {
      return true;
    }
    if (isCreatingEnabledAddresses || isCreatingMissingAddresses) {
      return true;
    }

    return false;
  }, [enabledNetworks, isCreatingEnabledAddresses, isCreatingMissingAddresses]);

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
        headerTitleAlign="center"
      />
      <Page.Body>
        {/* eslint-disable no-nested-ternary */}
        {showTabSwitcher ? (
          platformEnv.isNative ? (
            <PagerView
              ref={pagerRef as RefObject<NativePagerView>}
              style={{ flex: 1 }}
              initialPage={TAB_TO_INDEX[initialTab]}
              onPageSelected={handlePageSelected}
              keyboardDismissMode="on-drag"
              pageWidth="100%"
            >
              <Stack flex={1}>
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
                  missingAddressCount={missingAddressCount}
                  setMissingAddressCount={setMissingAddressCount}
                  networks={networks}
                  accountNetworkValues={accountNetworkValues}
                  accountNetworkValueCurrency={accountNetworkValueCurrency}
                  accountDeFiOverview={accountDeFiOverview}
                />
              </Stack>
              <Stack flex={1}>
                <NetworkContent
                  walletId={walletId}
                  accountId={accountId}
                  indexedAccountId={indexedAccountId}
                  networkId={networkId}
                  networkIds={networkIds}
                  onPressItem={handleNetworkPressItem}
                  onAddCustomNetwork={handleAddCustomNetwork}
                  onEditCustomNetwork={handleEditCustomNetwork}
                  searchText={searchKey}
                  setSearchText={setSearchKey}
                />
              </Stack>
            </PagerView>
          ) : (
            <>
              <Stack
                flex={1}
                display={activeTab === 'portfolio' ? 'flex' : 'none'}
              >
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
                  missingAddressCount={missingAddressCount}
                  setMissingAddressCount={setMissingAddressCount}
                  networks={networks}
                  accountNetworkValues={accountNetworkValues}
                  accountNetworkValueCurrency={accountNetworkValueCurrency}
                  accountDeFiOverview={accountDeFiOverview}
                />
              </Stack>
              <Stack
                flex={1}
                display={activeTab === 'network' ? 'flex' : 'none'}
              >
                <NetworkContent
                  walletId={walletId}
                  accountId={accountId}
                  indexedAccountId={indexedAccountId}
                  networkId={networkId}
                  networkIds={networkIds}
                  onPressItem={handleNetworkPressItem}
                  onAddCustomNetwork={handleAddCustomNetwork}
                  onEditCustomNetwork={handleEditCustomNetwork}
                  searchText={searchKey}
                  setSearchText={setSearchKey}
                />
              </Stack>
            </>
          )
        ) : (
          <Stack flex={1}>
            <NetworkContent
              walletId={walletId}
              accountId={accountId}
              indexedAccountId={indexedAccountId}
              networkId={networkId}
              networkIds={networkIds}
              onPressItem={handleNetworkPressItem}
              onAddCustomNetwork={handleAddCustomNetwork}
              onEditCustomNetwork={handleEditCustomNetwork}
              searchText={searchKey}
              setSearchText={setSearchKey}
            />
          </Stack>
        )}
        {/* eslint-enable no-nested-ternary */}
      </Page.Body>
      {activeTab === 'portfolio' ? (
        <Page.Footer>
          <Stack
            p="$5"
            gap="$2.5"
            bg="$bgApp"
            flexDirection="column-reverse"
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {missingAddressCount > 0 ? (
              <SizableText
                size="$bodyMd"
                color="$textCaution"
                textAlign="center"
                $gtMd={{ flex: 1, textAlign: 'left' }}
              >
                {intl.formatMessage(
                  {
                    id: ETranslations.current_account_missing_addresses,
                  },
                  { count: missingAddressCount },
                )}
              </SizableText>
            ) : null}
            <Button
              size="large"
              $gtMd={{ size: 'medium', ml: 'auto' }}
              variant="primary"
              loading={isCreatingEnabledAddresses}
              disabled={isConfirmDisabled}
              onPress={async () => {
                try {
                  await handlePortfolioDone();
                } catch {
                  // error already handled inside handlePortfolioDone
                }
              }}
              testID="page-footer-confirm"
            >
              {confirmButtonText}
            </Button>
          </Stack>
        </Page.Footer>
      ) : null}
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
