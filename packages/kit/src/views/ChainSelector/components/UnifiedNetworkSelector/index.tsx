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
  resetChainSelectorModal,
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
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useFindNetworksWithoutAccount } from '../../hooks/useFindNetworksWithoutAccount';
import { ChainSelectorTestIDs } from '../../testIDs';

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

  // Portfolio tab state (from AllNetworksManager).
  // Seed from the SWR cache synchronously so the first render doesn't flash
  // the "no results" empty state before the useEffect below copies the
  // revalidated networkMeta into state. The setter is still needed because
  // handleAddCustomNetwork updates this locally before persisting to bg.
  const [networksState, setNetworksState] = useState<{
    enabledNetworks: Record<string, boolean>;
    disabledNetworks: Record<string, boolean>;
  }>(() => {
    const cached = swrCacheUtils.get<{
      allNetworksState: {
        enabledNetworks: Record<string, boolean>;
        disabledNetworks: Record<string, boolean>;
      };
    }>(swrKeys.unifiedNetworkSelectorMeta({ walletId, accountId }));
    return (
      cached?.allNetworksState ?? {
        enabledNetworks: {},
        disabledNetworks: {},
      }
    );
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

  const [_enabledNetworksWithoutAccount, setEnabledNetworksWithoutAccount] =
    useState<
      {
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }[]
    >([]);

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

  // Split into two hooks so the list skeleton can hydrate from MMKV on mount
  // while balances/DeFi stay off the cache (stale money values would mislead
  // the user more than a short skeleton does).
  const { result: networkMeta, run: refreshNetworkMeta } = usePromiseResult(
    async () => {
      const [allNetworksStateResp, { networks: allNetworks }] =
        await Promise.all([
          backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
          backgroundApiProxy.serviceNetwork.getAllNetworks(),
        ]);

      const compatibleNetworks =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          {
            accountId,
            walletId,
            networkIds: allNetworks.map((network) => network.id),
            excludeTestNetwork: true,
          },
        );

      return {
        allNetworksState: {
          enabledNetworks: allNetworksStateResp.enabledNetworks,
          disabledNetworks: allNetworksStateResp.disabledNetworks,
        },
        allNetworks,
        compatibleNetworks,
      };
    },
    [accountId, walletId],
    {
      swrKey: swrKeys.unifiedNetworkSelectorMeta({ walletId, accountId }),
    },
  );

  // Derive `networks` straight from the SWR result so the first render
  // reflects cached data without a frame of empty arrays. Using useMemo
  // instead of useState+useEffect eliminates the "no results" flash on
  // Portfolio tab — previously the effect only copied networkMeta into
  // state after mount, so the first render paint saw empty arrays.
  //
  // `networksState` stays as useState (seeded from cache above) because
  // handleAddCustomNetwork needs a setter to optimistically toggle
  // enable/disable before the bg round-trip.
  const networks = useMemo<{
    allNetworks: IServerNetworkMatch[];
    mainNetworks: IServerNetworkMatch[];
    frequentlyUsedNetworks: IServerNetworkMatch[];
  }>(
    () => ({
      allNetworks: networkMeta?.allNetworks ?? [],
      mainNetworks: networkMeta?.compatibleNetworks.mainnetItems ?? [],
      frequentlyUsedNetworks:
        networkMeta?.compatibleNetworks.frequentlyUsedItems ?? [],
    }),
    [networkMeta],
  );

  // Keep networksState in sync with revalidation. The seed above handles
  // first paint; this effect picks up later updates from the SWR fetch.
  useEffect(() => {
    if (!networkMeta) return;
    setNetworksState(networkMeta.allNetworksState);
  }, [networkMeta]);

  // Derive the enabled subset from networks + state. Lives after the
  // `networks` useMemo to keep declaration order clean.
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

  const compatibleNetworks = networkMeta?.compatibleNetworks;

  // Balances + DeFi: now SWR-cached via the cold-start MMKV instance so the
  // "networks with assets" (有资产的网络) section is present on the very first
  // render frame, eliminating the layout jump that happened when this section
  // popped in only after the async resolved. The request still always fires and
  // revalidates the cache in place; the cached values are local USD snapshots,
  // so brief staleness before revalidation is acceptable. Only primitive
  // (MMKV-serializable) fields are returned — Record<string,string> values, a
  // currency string, and Record<string,{ netWorth: number }> DeFi overview;
  // never the IServerNetwork objects from compatibleNetworks. Depends on
  // compatibleNetworks for the sort step, so meta changes fan out here via the
  // `compatibleNetworks` dep.
  const { result: accountValuesResult } = usePromiseResult(
    async (): Promise<
      | {
          accountNetworkValues: Record<string, string>;
          currency: string | undefined;
          accountDeFiOverview: Record<string, { netWorth: number }>;
        }
      | undefined
    > => {
      // Return `undefined` (not an empty object) when we cannot compute a real
      // result yet. usePromiseResult only writes the swr cache when the result
      // is `!== undefined`, so this prevents a transient pre-meta run from
      // overwriting a previously-good cached snapshot (which would bring the
      // layout jump back on the next cold start). An empty *computed* result
      // below (account genuinely has no assets) is still returned and cached.
      if (!compatibleNetworks) {
        return undefined;
      }
      if (!accountId && !indexedAccountId) {
        return undefined;
      }

      const [_accountsValue, _localDeFiOverview] = await Promise.all([
        backgroundApiProxy.serviceAccountProfile.getAllNetworkAccountsValueByAccountId(
          { accountId: indexedAccountId ?? accountId ?? '' },
        ),
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

      if (_accountsValue || _localDeFiOverview[0]) {
        const {
          formattedAccountNetworkValues,
          accountDeFiOverview: _accountDeFiOverview,
        } =
          await backgroundApiProxy.serviceNetwork.sortChainSelectorNetworksByValue(
            {
              walletId: accountUtils.getWalletIdFromAccountId({
                accountId: _accountsValue?.accountId ?? '',
              }),
              chainSelectorNetworks: compatibleNetworks,
              accountNetworkValues: _accountsValue?.value ?? {},
              localDeFiOverview: _localDeFiOverview[0]?.overview ?? {},
            },
          );

        return {
          accountNetworkValues: formattedAccountNetworkValues ?? {},
          currency: _accountsValue?.currency,
          accountDeFiOverview: _accountDeFiOverview ?? {},
        };
      }

      // Defensive: `_accountsValue` is always a truthy object, so this branch
      // is effectively unreachable, but if it ever is hit we have no data to
      // compute — return `undefined` to leave the cache untouched.
      return undefined;
    },
    // walletId is kept in deps because it feeds the swrKey: a wallet-scope
    // change must trigger revalidation. exhaustive-deps only inspects the
    // callback body (which derives its own walletId from the resolved account)
    // and therefore flags walletId as unnecessary — suppress that here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, indexedAccountId, compatibleNetworks, walletId],
    {
      swrKey: swrKeys.unifiedNetworkSelectorValues({
        walletId,
        accountId,
        indexedAccountId,
      }),
    },
  );

  // Derive the portfolio values straight from the SWR result so the first
  // render reflects cached data without a frame of empty objects. Declared
  // after the usePromiseResult above to keep hook ordering stable.
  const accountNetworkValues = useMemo(
    () => accountValuesResult?.accountNetworkValues ?? {},
    [accountValuesResult],
  );
  const accountNetworkValueCurrency = useMemo(
    () => accountValuesResult?.currency,
    [accountValuesResult],
  );
  const accountDeFiOverview = useMemo(
    () => accountValuesResult?.accountDeFiOverview ?? {},
    [accountValuesResult],
  );

  // Refresh portfolio data when a custom network is added. Meta revalidation
  // produces a new compatibleNetworks reference, which cascades into the
  // values hook via its deps — no explicit values refresh needed here.
  useEffect(() => {
    const fn = async () => {
      try {
        // alwaysSetState bypasses the isFocused guard because this event can
        // fire while the back-nav animation is still running.
        await refreshNetworkMeta({ alwaysSetState: true });
      } catch {
        // silently ignore refresh errors
      }
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, fn);
    };
  }, [refreshNetworkMeta]);

  // Network tab callbacks
  const handleNetworkPressItem = useCallback(
    async (item: IServerNetwork) => {
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

      try {
        await actions.current.updateSelectedAccountNetwork({
          num,
          networkId: item.id,
        });
      } finally {
        // Surgically drop only the ChainSelectorModal route. popStack() triggers
        // the iOS RNSScreenStack window=NIL retry storm, and resetAboveMainRoute
        // would also close any parent modal that pushed us here.
        // See ios-overlay-navigation-freeze.md.
        resetChainSelectorModal();
      }
    },
    [actions, num, recordNetworkHistoryEnabled, activeNetwork, sceneName],
  );

  const handleAddCustomNetwork = useCallback(() => {
    navigation.push(EChainSelectorPagesEnum.ChainListSearch, {
      onSuccess: async (network: IServerNetwork) => {
        if (activeTabRef.current === 'portfolio') {
          // Portfolio tab: enable the new network and persist to backend.
          // Persist first to avoid race condition: refreshNetworkMeta
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
            cacheContext: { walletId, accountId },
          });
          appEventBus.emit(EAppEventBusNames.AddedCustomNetwork, undefined);
        } else {
          // Network tab: select network and close modal (original behavior)
          void handleNetworkPressItem(network);
        }
      },
    });
  }, [navigation, handleNetworkPressItem, networksState, walletId, accountId]);

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
          cacheContext: { walletId, accountId },
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

      // pop() falls through to popStack() when UnifiedNetworkSelector is the
      // modal root, triggering the iOS RNSScreenStack window=NIL retry storm.
      // Surgically drop only the ChainSelectorModal route to preserve any parent
      // modal that pushed us here. See ios-overlay-navigation-freeze.md.
      resetChainSelectorModal();

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
        testID={ChainSelectorTestIDs.unifiedAddNetworkBtn}
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
      // Page safeAreaEnabled + SectionList contentContainerStyle.paddingBottom
      // double-counted the home indicator inset (~34px each). Defer
      // bottom safe area to the list's contentContainerStyle so the
      // padding lives on the scroll container and doesn't animate
      // during modal presentation. Matches EditableChainSelector/index.
      safeAreaEnabled={false}
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
              testID={ChainSelectorTestIDs.unifiedPortfolioConfirmBtn}
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
