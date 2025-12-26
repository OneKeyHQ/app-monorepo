import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { differenceBy, isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IPageNavigationProp,
  IPageScreenProps,
} from '@onekeyhq/components';
import {
  Empty,
  Icon,
  Page,
  SearchBar,
  SectionList,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useFuseSearch } from '@onekeyhq/kit/src/views/ChainSelector/hooks/useFuseSearch';
import type { IAllNetworksDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAllNetworks';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useAllNetworksPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalWalletAddressRoutes,
  IModalWalletAddressParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import debugUtils, {
  useDebugHooksDepsChangedChecker,
} from '@onekeyhq/shared/src/utils/debug/debugUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import {
  EAccountSelectorSceneName,
  type IServerNetwork,
} from '@onekeyhq/shared/types';
import { EWalletAddressActionType } from '@onekeyhq/shared/types/address';

import { WalletAddressContext } from './WalletAddressContext';

import type { IWalletAddressContext } from './WalletAddressContext';

const log = debugUtils.createSimpleDebugLog('<WalletAddressPage>', true);

type ISectionItem = {
  title?: string;
  data: IServerNetwork[];
};

function WalletAddressListItemIcon({
  account,
}: {
  account?: IAllNetworkAccountInfo;
}) {
  const { actionType } = useContext(WalletAddressContext);

  if (!account) {
    return <Icon name="PlusLargeOutline" color="$iconSubdued" />;
  }

  if (actionType === EWalletAddressActionType.ViewInExplorer) {
    return <Icon name="OpenOutline" color="$iconSubdued" />;
  }

  return (
    <XStack gap="$6" alignItems="center">
      <Icon name="Copy3Outline" color="$iconSubdued" />
    </XStack>
  );
}
const WalletAddressListItemIconMemo = memo(WalletAddressListItemIcon);

function SingleWalletAddressListItem({ network }: { network: IServerNetwork }) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const {
    walletId,
    networkAccountMap,
    indexedAccountId,
    refreshLocalData,
    isAllNetworksEnabled,
    setIsAllNetworksEnabled,
    setAccountsCreated,
    actionType,
  } = useContext(WalletAddressContext);

  const isEnabledNetwork = isAllNetworksEnabled[network.id];

  const copyAccountAddress = useCopyAccountAddress();
  const appNavigation =
    useAppNavigation<IPageNavigationProp<IModalWalletAddressParamList>>();

  const { createAddress } = useAccountSelectorCreateAddress();
  const account = useMemo(
    () => networkAccountMap[network.id]?.[0],
    [networkAccountMap, network.id],
  );

  const subtitle = useMemo(() => {
    if (account) {
      if (networkUtils.isLightningNetworkByNetworkId(network.id)) {
        return '';
      }

      return accountUtils.shortenAddress({ address: account.apiAddress });
    }

    return intl.formatMessage({
      id: ETranslations.copy_address_modal_item_create_address_instruction,
    });
  }, [account, intl, network.id]);

  const onPress = useCallback(async () => {
    if (!account) {
      try {
        setLoading(true);
        const globalDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: network.id,
          });

        const createAddressResult = await createAddress({
          account: {
            walletId,
            networkId: network.id,
            indexedAccountId,
            deriveType: globalDeriveType,
          },
          selectAfterCreate: false,
          num: 0,
        });
        if (createAddressResult) {
          setAccountsCreated(true);
          setIsAllNetworksEnabled((prev) => ({
            ...prev,
            [network.id]: true,
          }));
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: { [network.id]: true },
          });
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.swap_page_toast_address_generated,
            }),
            message: intl.formatMessage({
              id: ETranslations.network_also_enabled,
            }),
          });
          refreshLocalData();
        }
      } finally {
        setLoading(false);
      }
    }

    if (actionType === EWalletAddressActionType.ViewInExplorer) {
      await openExplorerAddressUrl({
        networkId: network.id,
        address: account?.apiAddress,
      });
      return;
    }

    if (networkUtils.isLightningNetworkByNetworkId(network.id)) {
      appNavigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.CreateInvoice,
        params: {
          networkId: network.id,
          accountId: account.accountId,
        },
      });
    } else if (account && account.apiAddress) {
      await copyAccountAddress({
        accountId: account.accountId,
        networkId: network.id,
        deriveInfo: account.deriveInfo,
        onDeriveTypeChange: () => {
          refreshLocalData({ alwaysSetState: true });
        },
      });
    }
  }, [
    account,
    actionType,
    network.id,
    createAddress,
    walletId,
    indexedAccountId,
    setAccountsCreated,
    setIsAllNetworksEnabled,
    intl,
    refreshLocalData,
    appNavigation,
    copyAccountAddress,
  ]);

  const avatar = useMemo(
    () => (
      <NetworkAvatarBase
        logoURI={network.logoURI}
        isCustomNetwork={network.isCustomNetwork}
        isAllNetworks={network.isAllNetworks}
        networkName={network.name}
        size="$10"
      />
    ),
    [
      network.isAllNetworks,
      network.isCustomNetwork,
      network.logoURI,
      network.name,
    ],
  );

  return useMemo(
    () => (
      <ListItem
        renderItemText={(textProps) => (
          <ListItem.Text
            {...textProps}
            primary={
              <XStack alignItems="center" gap="$2">
                <SizableText size="$bodyLgMedium">{network.name}</SizableText>
                {networkUtils
                  .getDefaultDeriveTypeVisibleNetworks()
                  .includes(network.id) ? (
                  <AddressTypeSelector
                    placement="bottom-start"
                    walletId={walletId ?? ''}
                    networkId={network.id}
                    activeDeriveType={account?.deriveType}
                    activeDeriveInfo={account?.deriveInfo}
                    indexedAccountId={indexedAccountId ?? ''}
                    onSelect={async () => {
                      refreshLocalData();
                    }}
                    onCreate={async ({ deriveType }) => {
                      const defaultDeriveType =
                        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                          {
                            networkId: network.id,
                          },
                        );
                      if (deriveType === defaultDeriveType) {
                        refreshLocalData();
                      }
                    }}
                  />
                ) : null}
              </XStack>
            }
            flex={1}
          />
        )}
        subtitle={subtitle}
        subtitleProps={{
          color:
            !isEnabledNetwork && account?.apiAddress
              ? '$textDisabled'
              : '$textSubdued',
        }}
        renderAvatar={avatar}
        onPress={onPress}
        disabled={loading}
      >
        {loading ? (
          <Stack p="$0.5">
            <Spinner />
          </Stack>
        ) : (
          <WalletAddressListItemIconMemo account={account} />
        )}
      </ListItem>
    ),
    [
      account,
      avatar,
      indexedAccountId,
      isEnabledNetwork,
      loading,
      network.id,
      network.name,
      onPress,
      refreshLocalData,
      subtitle,
      walletId,
    ],
  );
}
const SingleWalletAddressListItemMemo = memo(SingleWalletAddressListItem);

function WalletAddressListItem({ network }: { network: IServerNetwork }) {
  return <SingleWalletAddressListItemMemo network={network} />;
}
const WalletAddressListItemMemo = memo(WalletAddressListItem);

function WalletAddressContent({
  mainnetItems: m,
  testnetItems: t,
  frequentlyUsedNetworks: f,
  actionType,
}: {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  frequentlyUsedNetworks: IServerNetwork[];
  actionType?: EWalletAddressActionType;
}) {
  log('WalletAddressContentRender');

  const intl = useIntl();
  const [searchText, setSearchText] = useState('');
  const { bottom } = useSafeAreaInsets();
  const [{ showEnabledNetworksOnlyInCopyAddressPanel }] =
    useAllNetworksPersistAtom();
  const { isAllNetworksEnabled } = useContext(WalletAddressContext);

  let mainnetItems = m;
  let testnetItems = t;
  let frequentlyUsedNetworks = f;

  if (showEnabledNetworksOnlyInCopyAddressPanel) {
    mainnetItems = mainnetItems.filter((o) => isAllNetworksEnabled[o.id]);
    testnetItems = testnetItems.filter((o) => isAllNetworksEnabled[o.id]);
    frequentlyUsedNetworks = frequentlyUsedNetworks.filter(
      (o) => isAllNetworksEnabled[o.id],
    );
  }

  if (actionType === EWalletAddressActionType.ViewInExplorer) {
    mainnetItems = mainnetItems.filter(
      (o) => !networkUtils.isViewInExplorerDisabled({ networkId: o.id }),
    );
    testnetItems = testnetItems.filter(
      (o) => !networkUtils.isViewInExplorerDisabled({ networkId: o.id }),
    );
    frequentlyUsedNetworks = frequentlyUsedNetworks.filter(
      (o) => !networkUtils.isViewInExplorerDisabled({ networkId: o.id }),
    );
  }

  const networksToSearch = useMemo<IServerNetwork[]>(
    () => [...mainnetItems, ...testnetItems],
    [mainnetItems, testnetItems],
  );

  const networkFuseSearch = useFuseSearch(networksToSearch);

  const sections = useMemo<ISectionItem[]>(() => {
    const searchTextTrim = searchText.trim();
    if (searchTextTrim) {
      const data = networkFuseSearch(searchTextTrim);
      return data.length === 0
        ? []
        : [
            {
              data,
            },
          ];
    }

    const frequentlyUsedNetworksSet = new Set(
      frequentlyUsedNetworks.map((o) => o.id),
    );
    const filterFrequentlyUsedNetworks = (inputs: IServerNetwork[]) =>
      inputs.filter((o) => !frequentlyUsedNetworksSet.has(o.id));

    const data = filterFrequentlyUsedNetworks(mainnetItems).reduce(
      (result, item) => {
        const char = item.name[0].toUpperCase();
        if (!result[char]) {
          result[char] = [];
        }
        result[char].push(item);

        return result;
      },
      {} as Record<string, IServerNetwork[]>,
    );
    const sectionList = Object.entries(data)
      .map(([key, value]) => ({ title: key, data: value }))
      .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));
    const _sections: ISectionItem[] = [
      { data: frequentlyUsedNetworks },
      ...sectionList,
    ];
    if (testnetItems.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.global_testnet,
        }),
        data: filterFrequentlyUsedNetworks(testnetItems),
      });
    }
    return _sections;
  }, [
    mainnetItems,
    frequentlyUsedNetworks,
    searchText,
    testnetItems,
    intl,
    networkFuseSearch,
  ]);

  const renderSectionHeader = useCallback(
    (item: { section: { title: string } }) => {
      if (item?.section?.title) {
        return <SectionList.SectionHeader title={item?.section?.title} />;
      }

      return <Stack h="$3" />;
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: IServerNetwork }) => (
      <WalletAddressListItemMemo network={item} />
    ),
    [],
  );

  const listView = useMemo(
    () => (
      <SectionList
        estimatedItemSize={60}
        stickySectionHeadersEnabled
        sections={sections}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListEmptyComponent={
          <Empty
            icon="SearchOutline"
            title={intl.formatMessage({ id: ETranslations.global_no_results })}
          />
        }
        ListFooterComponent={<Stack h={bottom || '$3'} />}
      />
    ),
    [bottom, intl, renderItem, renderSectionHeader, sections],
  );

  return (
    <Stack flex={1}>
      <Stack px="$5">
        <SearchBar
          placeholder={intl.formatMessage({
            id: ETranslations.form_search_network_placeholder,
          })}
          value={searchText}
          onChangeText={(text) => setSearchText(text)}
        />
      </Stack>
      {listView}
    </Stack>
  );
}
const WalletAddressContentMemo = memo(WalletAddressContent);

function WalletAddressPageView({
  onClose,
  children,
}: {
  onClose?: () => Promise<void>;
  children: React.ReactNode;
  walletId?: string;
  accountId?: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();
  const { title } = useContext(WalletAddressContext);
  return (
    <Page safeAreaEnabled={false} onClose={onClose}>
      <Page.Header
        // title={accountId || ''}
        title={
          title ||
          intl.formatMessage({
            id: ETranslations.copy_address_modal_title,
          })
        }
      />
      <Page.Body>{children}</Page.Body>
    </Page>
  );
}

function WalletAddress({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  accountId,
  walletId,
  indexedAccountId,
  mainnetItems,
  testnetItems,
  frequentlyUsedNetworks,
  actionType,
}: {
  accountId: string | undefined;
  walletId: string | undefined;
  indexedAccountId: string | undefined;
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  frequentlyUsedNetworks: IServerNetwork[];
  actionType?: EWalletAddressActionType;
}) {
  const {
    originalAllNetworksState,
    accountsCreated,
    allNetworksStateInit,
    originalAllNetworksStateInit,
  } = useContext(WalletAddressContext);

  const onClose = useCallback(async () => {
    if (
      !allNetworksStateInit.current ||
      !originalAllNetworksStateInit.current
    ) {
      return;
    }

    const latestAllNetworksState =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
    if (
      accountsCreated ||
      differenceBy(
        Object.entries(latestAllNetworksState.disabledNetworks),
        Object.entries(originalAllNetworksState.disabledNetworks),
        ([networkId]) => networkId,
      ).length > 0 ||
      differenceBy(
        Object.entries(latestAllNetworksState.enabledNetworks),
        Object.entries(originalAllNetworksState.enabledNetworks),
        ([networkId]) => networkId,
      ).length > 0
    ) {
      // TODO performance, always emit when Modal open
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
    }
  }, [
    accountsCreated,
    allNetworksStateInit,
    originalAllNetworksState.disabledNetworks,
    originalAllNetworksState.enabledNetworks,
    originalAllNetworksStateInit,
  ]);

  return (
    <WalletAddressPageView
      onClose={onClose}
      walletId={walletId}
      accountId={accountId}
      indexedAccountId={indexedAccountId}
    >
      <WalletAddressContentMemo
        testnetItems={testnetItems}
        mainnetItems={mainnetItems}
        frequentlyUsedNetworks={frequentlyUsedNetworks}
        actionType={actionType}
      />
    </WalletAddressPageView>
  );
}
const WalletAddressMemo = memo(WalletAddress);

function PageLoading() {
  return (
    <WalletAddressPageView>
      <Stack p="$5" h="$100" alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </Stack>
    </WalletAddressPageView>
  );
}

function WalletAddressPageMainView({
  title,
  actionType,
  accountId,
  walletId,
  indexedAccountId,
  excludeTestNetwork,
  includingNotEqualGlobalDeriveTypeAccount,
  includingDeriveTypeMismatchInDefaultVisibleNetworks,
}: {
  title?: string;
  actionType?: EWalletAddressActionType;
  accountId?: string;
  walletId?: string;
  indexedAccountId: string;
  excludeTestNetwork?: boolean;
  includingNotEqualGlobalDeriveTypeAccount?: boolean;
  includingDeriveTypeMismatchInDefaultVisibleNetworks?: boolean;
}) {
  const [accountsCreated, setAccountsCreated] = useState(false);
  const [isAllNetworksEnabled, setIsAllNetworksEnabled] = useState<
    Record<string, boolean>
  >({});

  const allNetworksStateInit = useRef(false);
  const originalAllNetworksStateInit = useRef(false);
  const [originalAllNetworksState, setOriginalAllNetworksState] =
    useState<IAllNetworksDBStruct>({
      disabledNetworks: {},
      enabledNetworks: {},
    });

  const {
    result,
    run: refreshLocalData,
    isLoading,
  } = usePromiseResult(
    async () => {
      const perf = perfUtils.createPerf({
        name: EPerformanceTimerLogNames.allNetwork__walletAddressPage,
      });

      perf.markStart('getChainSelectorNetworksCompatibleWithAccountId');
      const networks =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          { accountId, walletId, excludeTestNetwork },
        );
      perf.markEnd('getChainSelectorNetworksCompatibleWithAccountId');

      // perf.markStart('buildNetworkIds');
      // const networkIds = Array.from(
      //   new Set(
      //     [
      //       ...networks.mainnetItems,
      //       ...networks.testnetItems,
      //       ...networks.frequentlyUsedItems,
      //     ].map((o) => o.id),
      //   ),
      // );
      // perf.markEnd('buildNetworkIds');

      // perf.markStart('getNetworkAccountsInSameIndexedAccountId');
      // const networksAccount =
      //   await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
      //     { networkIds, indexedAccountId },
      //   );
      // perf.markEnd('getNetworkAccountsInSameIndexedAccountId');

      perf.markStart('getAllNetworkAccounts');
      let networksAccount: IAllNetworkAccountInfo[] = [];
      if (accountId) {
        const { accountsInfo } =
          await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
            accountId,
            networkId: getNetworkIdsMap().onekeyall,
            excludeTestNetwork: excludeTestNetwork ?? false,
            includingNotEqualGlobalDeriveTypeAccount:
              includingNotEqualGlobalDeriveTypeAccount ?? false,
            includingDeriveTypeMismatchInDefaultVisibleNetworks:
              includingDeriveTypeMismatchInDefaultVisibleNetworks ?? false,
          });
        networksAccount = accountsInfo;
      }
      perf.markEnd('getAllNetworkAccounts');

      perf.markStart('getAllNetworksState');
      const allNetworksState: IAllNetworksDBStruct =
        await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();

      perf.markEnd('getAllNetworksState');

      perf.done();

      log('fetchBaseData');

      if (!originalAllNetworksStateInit.current) {
        setOriginalAllNetworksState(allNetworksState);
        originalAllNetworksStateInit.current = true;
      }

      return {
        networksAccount,
        networks,
        allNetworksState,
      };
    },
    [
      accountId,
      walletId,
      excludeTestNetwork,
      includingNotEqualGlobalDeriveTypeAccount,
      includingDeriveTypeMismatchInDefaultVisibleNetworks,
    ],
    {
      watchLoading: true,
      initResult: {
        networksAccount: [],
        allNetworksState: {
          disabledNetworks: {},
          enabledNetworks: {},
        },
        networks: {
          mainnetItems: [],
          testnetItems: [],
          unavailableItems: [],
          frequentlyUsedItems: [],
        },
      },
    },
  );

  useEffect(() => {
    if (
      allNetworksStateInit.current ||
      isEmpty([
        ...result.networks.mainnetItems,
        ...result.networks.testnetItems,
      ]) ||
      isNil(result.allNetworksState)
    ) {
      return;
    }

    allNetworksStateInit.current = true;

    const updateMap: Record<string, boolean> = {};

    [...result.networks.mainnetItems, ...result.networks.testnetItems].forEach(
      (item) => {
        updateMap[item.id] = isEnabledNetworksInAllNetworks({
          networkId: item.id,
          isTestnet: item.isTestnet,
          disabledNetworks: result.allNetworksState.disabledNetworks,
          enabledNetworks: result.allNetworksState.enabledNetworks,
        });
      },
    );
    setIsAllNetworksEnabled((prev) => ({
      ...prev,
      ...updateMap,
    }));
    log('update-isAllNetworksEnabledWrapper');
  }, [
    result.allNetworksState,
    result.networks.mainnetItems,
    result.networks.testnetItems,
    result.networksAccount,
    excludeTestNetwork,
  ]);

  useEffect(() => {
    const refresh = async () => {
      allNetworksStateInit.current = false;
      await refreshLocalData({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.EnabledNetworksChanged, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.EnabledNetworksChanged, refresh);
    };
  }, [refreshLocalData]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { checkDeps } = useDebugHooksDepsChangedChecker(
    'WalletAddressContextCalculate',
  );

  const context = useMemo(() => {
    log('contextCalculate');
    // checkDeps({
    //   allNetworksState: result.allNetworksState,
    //   networksAccount: result.networksAccount,
    //   accountId,
    //   indexedAccountId,
    //   refreshLocalData,
    //   accountsCreated,
    //   isAllNetworksEnabled,
    //   isOnlyOneNetworkVisible,
    // });

    const networkAccountMap: Record<string, IAllNetworkAccountInfo[]> = {};
    for (let i = 0; i < result.networksAccount.length; i += 1) {
      const item = result.networksAccount[i];
      const { networkId, dbAccount } = item;
      if (dbAccount) {
        networkAccountMap[networkId] = [
          ...(networkAccountMap[networkId] ?? []),
          item,
        ];
      }
    }
    const contextData: IWalletAddressContext = {
      title,
      networkAccountMap,
      originalAllNetworksState,
      accountId,
      walletId,
      indexedAccountId,
      refreshLocalData,
      accountsCreated,
      setAccountsCreated,
      isAllNetworksEnabled,
      setIsAllNetworksEnabled,
      allNetworksStateInit,
      originalAllNetworksStateInit,
      actionType,
    };
    return contextData;
  }, [
    title,
    actionType,
    originalAllNetworksState,
    accountId,
    walletId,
    indexedAccountId,
    refreshLocalData,
    accountsCreated,
    isAllNetworksEnabled,
    result.networksAccount,
  ]);

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <WalletAddressContext.Provider value={context}>
        {isLoading && !result.networks?.mainnetItems?.length ? (
          <PageLoading />
        ) : (
          <WalletAddressMemo
            walletId={walletId}
            accountId={accountId} // route.params.accountId
            indexedAccountId={indexedAccountId}
            testnetItems={result.networks.testnetItems}
            mainnetItems={result.networks.mainnetItems}
            frequentlyUsedNetworks={result.networks.frequentlyUsedItems}
            actionType={actionType}
          />
        )}
      </WalletAddressContext.Provider>
    </AccountSelectorProviderMirror>
  );
}

const WalletAddressPageMainViewMemo = memo(WalletAddressPageMainView);

export default function WalletAddressPage({
  route,
}: IPageScreenProps<
  IModalWalletAddressParamList,
  EModalWalletAddressRoutes.WalletAddress
>) {
  const {
    title,
    accountId,
    walletId,
    indexedAccountId,
    excludeTestNetwork,
    includingNotEqualGlobalDeriveTypeAccount,
    includingDeriveTypeMismatchInDefaultVisibleNetworks,
    actionType,
  } = route.params;

  const { result: allNetworkMockedAccountId } = usePromiseResult(async () => {
    if (!accountId) {
      const allNetworkMockedAccount =
        await backgroundApiProxy.serviceAccount.getMockedAllNetworkAccount({
          indexedAccountId,
        });
      return allNetworkMockedAccount?.id || accountId;
    }
    return accountId;
  }, [accountId, indexedAccountId]);

  if (!allNetworkMockedAccountId) {
    return <PageLoading />;
  }

  return (
    <WalletAddressPageMainViewMemo
      title={title}
      actionType={actionType}
      accountId={allNetworkMockedAccountId}
      walletId={walletId}
      indexedAccountId={indexedAccountId}
      excludeTestNetwork={excludeTestNetwork}
      includingNotEqualGlobalDeriveTypeAccount={
        includingNotEqualGlobalDeriveTypeAccount
      }
      includingDeriveTypeMismatchInDefaultVisibleNetworks={
        includingDeriveTypeMismatchInDefaultVisibleNetworks
      }
    />
  );
}
