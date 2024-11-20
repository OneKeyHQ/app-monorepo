import {
  createContext,
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
  IconButton,
  Page,
  SearchBar,
  SectionList,
  Spinner,
  Stack,
  Toast,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useFuseSearch } from '@onekeyhq/kit/src/views/ChainSelector/hooks/useFuseSearch';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  EModalWalletAddressRoutes,
  type IModalWalletAddressParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import {
  EAccountSelectorSceneName,
  type IServerNetwork,
} from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';

type IWalletAddressContext = {
  networkAccountMap: Record<string, INetworkAccount>;
  networkDeriveTypeMap: Record<string, IAccountDeriveTypes>;
  accountId?: string;
  indexedAccountId: string;
  refreshLocalData: () => void;
  accountsCreated: boolean;
  setAccountsCreated: (accountsCreated: boolean) => void;
  initAllNetworksState: {
    enabledNetworks: {
      networkId: string;
    }[];
    disabledNetworks: {
      networkId: string;
    }[];
  };
  isAllNetworksEnabled: Record<string, boolean>;
  setIsAllNetworksEnabled: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  isAllNetworksEnabledWrapper: Record<string, boolean>;
  setIsAllNetworksEnabledWrapper: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  isOnlyOneNetworkEnabled: boolean;
};

const WalletAddressContext = createContext<IWalletAddressContext>({
  networkAccountMap: {},
  networkDeriveTypeMap: {},
  accountId: '',
  indexedAccountId: '',
  refreshLocalData: () => {},
  initAllNetworksState: {
    enabledNetworks: [],
    disabledNetworks: [],
  },
  accountsCreated: false,
  setAccountsCreated: () => {},
  isAllNetworksEnabled: {},
  setIsAllNetworksEnabled: () => {},
  isAllNetworksEnabledWrapper: {},
  setIsAllNetworksEnabledWrapper: () => {},
  isOnlyOneNetworkEnabled: false,
});

type ISectionItem = {
  title?: string;
  data: IServerNetwork[];
};

const WalletAddressDeriveTypeItem = ({ item }: { item: IServerNetwork }) => {
  const appNavigation =
    useAppNavigation<IPageNavigationProp<IModalWalletAddressParamList>>();
  const intl = useIntl();
  const {
    indexedAccountId,
    initAllNetworksState,
    isAllNetworksEnabled,
    setIsAllNetworksEnabled,
    setIsAllNetworksEnabledWrapper,
    isOnlyOneNetworkEnabled,
  } = useContext(WalletAddressContext);
  const { result, run: onRefreshData } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId: item.id,
          indexedAccountId,
        },
      ),
    [item.id, indexedAccountId],
  );

  const deriveAccounts = result?.networkAccounts ?? [];
  const isDeriveAccountsInitialized = !isNil(result?.networkAccounts);

  const deriveAccountsEnabledCount = deriveAccounts.filter(
    (a) => a.account,
  ).length;

  const isEnabledNetworkFromDB = isEnabledNetworksInAllNetworks({
    networkId: item.id,
    isTestnet: item.isTestnet,
    disabledNetworks: initAllNetworksState.disabledNetworks,
    enabledNetworks: initAllNetworksState.enabledNetworks,
  });

  const isEnabledNetwork =
    isAllNetworksEnabled[item.id] ?? isEnabledNetworkFromDB;

  useEffect(() => {
    setIsAllNetworksEnabledWrapper((prev) => ({
      ...prev,
      [item.id]: deriveAccountsEnabledCount > 0 ? isEnabledNetwork : false,
    }));
  }, [
    isEnabledNetwork,
    item.id,
    setIsAllNetworksEnabledWrapper,
    deriveAccountsEnabledCount,
  ]);

  const onPress = useCallback(() => {
    appNavigation.push(EModalWalletAddressRoutes.DeriveTypesAddress, {
      networkId: item.id,
      indexedAccountId,
      onUnmounted: onRefreshData,
      actionType: EDeriveAddressActionType.Copy,
    });
  }, [appNavigation, indexedAccountId, item.id, onRefreshData]);

  const subtitle = useMemo(
    () =>
      !isDeriveAccountsInitialized || deriveAccountsEnabledCount > 0
        ? intl.formatMessage(
            { id: ETranslations.global_count_addresses },
            { count: deriveAccountsEnabledCount },
          )
        : intl.formatMessage({
            id: ETranslations.copy_address_modal_item_create_address_instruction,
          }),
    [intl, deriveAccountsEnabledCount, isDeriveAccountsInitialized],
  );

  return (
    <ListItem
      title={item.name}
      subtitle={subtitle}
      onPress={onPress}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={item.logoURI}
          isCustomNetwork={item.isCustomNetwork}
          networkName={item.name}
          size="$10"
        />
      }
    >
      <XStack gap="$6" alignItems="center">
        {!isDeriveAccountsInitialized || deriveAccountsEnabledCount > 0 ? (
          <IconButton
            disabled={
              (isOnlyOneNetworkEnabled && isEnabledNetwork) || item.isTestnet
            }
            title={
              isEnabledNetwork
                ? intl.formatMessage({
                    id: ETranslations.network_visible_in_all_network_tooltip_title,
                  })
                : intl.formatMessage({
                    id: ETranslations.network_invisible_in_all_network_tooltip_title,
                  })
            }
            variant="tertiary"
            icon={isEnabledNetwork ? 'EyeOutline' : 'EyeClosedOutline'}
            iconProps={{
              color: isEnabledNetwork ? '$iconSubdued' : '$iconDisabled',
            }}
            onPress={async () => {
              if (item.isTestnet) return;
              setIsAllNetworksEnabled((prev) => ({
                ...prev,
                [item.id]: !isEnabledNetwork,
              }));
              const disabledNetworks: {
                networkId: string;
              }[] = [];
              const enabledNetworks: {
                networkId: string;
              }[] = [];
              if (isEnabledNetwork) {
                deriveAccounts.forEach((a) => {
                  disabledNetworks.push({
                    networkId: item.id,
                  });
                });
              } else {
                deriveAccounts.forEach((a) => {
                  enabledNetworks.push({
                    networkId: item.id,
                  });
                });
              }
              await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState(
                {
                  enabledNetworks,
                  disabledNetworks,
                },
              );
              Toast.success({
                title: isEnabledNetwork
                  ? intl.formatMessage(
                      {
                        id: ETranslations.feedback_network_hidden_from_all_networks_toast_title,
                      },
                      {
                        network: item.name,
                      },
                    )
                  : intl.formatMessage(
                      {
                        id: ETranslations.feedback_network_shown_in_all_networks_toast_title,
                      },
                      {
                        network: item.name,
                      },
                    ),
              });
            }}
          />
        ) : null}
        <Icon
          name={
            !isDeriveAccountsInitialized || deriveAccountsEnabledCount > 0
              ? 'Copy3Outline'
              : 'PlusLargeOutline'
          }
          color="$iconSubdued"
        />
      </XStack>
    </ListItem>
  );
};

const WalletAddressListItemIcon = ({
  account,
  network,
  deriveType,
}: {
  account?: INetworkAccount;
  network: IServerNetwork;
  deriveType: IAccountDeriveTypes;
}) => {
  const {
    isAllNetworksEnabled,
    setIsAllNetworksEnabled,
    initAllNetworksState,
    setIsAllNetworksEnabledWrapper,
    isOnlyOneNetworkEnabled,
  } = useContext(WalletAddressContext);
  const intl = useIntl();

  const isEnabledNetworkFromDB = isEnabledNetworksInAllNetworks({
    networkId: network.id,
    isTestnet: network.isTestnet,
    disabledNetworks: initAllNetworksState.disabledNetworks,
    enabledNetworks: initAllNetworksState.enabledNetworks,
  });

  const isEnabledNetwork =
    isAllNetworksEnabled[network.id] ?? isEnabledNetworkFromDB;

  useEffect(() => {
    setIsAllNetworksEnabledWrapper((prev) => ({
      ...prev,
      [network.id]: account ? isEnabledNetwork : false,
    }));
  }, [
    isEnabledNetwork,
    network.id,
    deriveType,
    setIsAllNetworksEnabledWrapper,
    account,
  ]);

  if (!account) {
    return <Icon name="PlusLargeOutline" color="$iconSubdued" />;
  }

  return (
    <XStack gap="$6" alignItems="center">
      <IconButton
        disabled={
          (isOnlyOneNetworkEnabled && isEnabledNetwork) || network.isTestnet
        }
        title={
          isEnabledNetwork
            ? intl.formatMessage({
                id: ETranslations.network_visible_in_all_network_tooltip_title,
              })
            : intl.formatMessage({
                id: ETranslations.network_invisible_in_all_network_tooltip_title,
              })
        }
        variant="tertiary"
        icon={isEnabledNetwork ? 'EyeOutline' : 'EyeClosedOutline'}
        iconProps={{
          color: isEnabledNetwork ? '$iconSubdued' : '$iconDisabled',
        }}
        onPress={async () => {
          setIsAllNetworksEnabled((prev) => ({
            ...prev,
            [network.id]: !isEnabledNetwork,
          }));
          const disabledNetworks = [];
          const enabledNetworks = [];
          if (isEnabledNetwork) {
            disabledNetworks.push({
              networkId: network.id,
            });
          } else {
            enabledNetworks.push({
              networkId: network.id,
            });
          }
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks,
            disabledNetworks,
          });
          Toast.success({
            title: isEnabledNetwork
              ? intl.formatMessage(
                  {
                    id: ETranslations.feedback_network_hidden_from_all_networks_toast_title,
                  },
                  {
                    network: network.name,
                  },
                )
              : intl.formatMessage(
                  {
                    id: ETranslations.feedback_network_shown_in_all_networks_toast_title,
                  },
                  {
                    network: network.name,
                  },
                ),
          });
        }}
      />
      <Icon name="Copy3Outline" color="$iconSubdued" />
    </XStack>
  );
};

const WalletAddressListItem = ({ item }: { item: IServerNetwork }) => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const {
    networkAccountMap,
    networkDeriveTypeMap,
    indexedAccountId,
    refreshLocalData,
    isAllNetworksEnabled,
    setIsAllNetworksEnabled,
    setAccountsCreated,
    initAllNetworksState,
  } = useContext(WalletAddressContext);

  const deriveType = networkDeriveTypeMap[item.id] || 'default';

  const isEnabledNetworkFromDB = isEnabledNetworksInAllNetworks({
    networkId: item.id,
    isTestnet: item.isTestnet,
    disabledNetworks: initAllNetworksState.disabledNetworks,
    enabledNetworks: initAllNetworksState.enabledNetworks,
  });

  const isEnabledNetwork =
    isAllNetworksEnabled[item.id] ?? isEnabledNetworkFromDB;

  const copyAccountAddress = useCopyAccountAddress();
  const appNavigation =
    useAppNavigation<IPageNavigationProp<IModalWalletAddressParamList>>();

  const { createAddress } = useAccountSelectorCreateAddress();
  const account = networkAccountMap[item.id] as INetworkAccount | undefined;
  const subtitle = account
    ? accountUtils.shortenAddress({ address: account.address })
    : intl.formatMessage({
        id: ETranslations.copy_address_modal_item_create_address_instruction,
      });

  const onPress = useCallback(async () => {
    if (!account) {
      try {
        setLoading(true);
        const { walletId } = accountUtils.parseIndexedAccountId({
          indexedAccountId,
        });
        const createAddressResult = await createAddress({
          account: {
            walletId,
            networkId: item.id,
            indexedAccountId,
            deriveType,
          },
          selectAfterCreate: false,
          num: 0,
        });
        if (createAddressResult) {
          if (!item.isTestnet) {
            setAccountsCreated(true);
            setIsAllNetworksEnabled((prev) => ({
              ...prev,
              [item.id]: true,
            }));
          }

          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: [{ networkId: item.id }],
          });
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.swap_page_toast_address_generated,
            }),
          });
          refreshLocalData();
        }
      } finally {
        setLoading(false);
      }
    } else if (networkUtils.isLightningNetworkByNetworkId(item.id)) {
      appNavigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.CreateInvoice,
        params: {
          networkId: item.id,
          accountId: account.id,
        },
      });
    } else if (account && account.address) {
      await copyAccountAddress({
        accountId: account.id,
        networkId: item.id,
      });
    }
  }, [
    account,
    item.id,
    item.isTestnet,
    indexedAccountId,
    createAddress,
    deriveType,
    intl,
    refreshLocalData,
    setAccountsCreated,
    setIsAllNetworksEnabled,
    appNavigation,
    copyAccountAddress,
  ]);

  if (
    item.id === getNetworkIdsMap().btc ||
    item.id === getNetworkIdsMap().ltc
  ) {
    return <WalletAddressDeriveTypeItem item={item} />;
  }
  return (
    <ListItem
      title={item.name}
      subtitle={subtitle}
      subtitleProps={{
        color:
          !isEnabledNetwork && account?.address
            ? '$textDisabled'
            : '$textSubdued',
      }}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={item.logoURI}
          isCustomNetwork={item.isCustomNetwork}
          networkName={item.name}
          size="$10"
        />
      }
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <Stack p="$0.5">
          <Spinner />
        </Stack>
      ) : (
        <WalletAddressListItemIcon
          account={account}
          network={item}
          deriveType={deriveType}
        />
      )}
    </ListItem>
  );
};

const WalletAddressContent = ({
  mainnetItems,
  testnetItems,
  frequentlyUsedNetworks,
}: {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  frequentlyUsedNetworks: IServerNetwork[];
}) => {
  const intl = useIntl();
  const [searchText, setSearchText] = useState('');
  const { bottom } = useSafeAreaInsets();

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
      <WalletAddressListItem item={item} />
    ),
    [],
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
    </Stack>
  );
};

const WalletAddress = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  accountId,
  mainnetItems,
  testnetItems,
  frequentlyUsedNetworks,
}: {
  accountId: string | undefined;
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  frequentlyUsedNetworks: IServerNetwork[];
}) => {
  const intl = useIntl();
  const { initAllNetworksState, accountsCreated } =
    useContext(WalletAddressContext);

  return (
    <Page
      safeAreaEnabled={false}
      onClose={async () => {
        const latestAllNetworksState =
          await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
        if (
          accountsCreated ||
          differenceBy(
            latestAllNetworksState.disabledNetworks,
            initAllNetworksState.disabledNetworks,
            ({ networkId }) => networkId,
          ).length > 0 ||
          differenceBy(
            latestAllNetworksState.enabledNetworks,
            initAllNetworksState.enabledNetworks,
            ({ networkId }) => networkId,
          ).length > 0
        ) {
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        }
      }}
    >
      <Page.Header
        // title={accountId || ''}
        title={intl.formatMessage({
          id: ETranslations.copy_address_modal_title,
        })}
      />
      <Page.Body>
        <WalletAddressContent
          testnetItems={testnetItems}
          mainnetItems={mainnetItems}
          frequentlyUsedNetworks={frequentlyUsedNetworks}
        />
      </Page.Body>
    </Page>
  );
};

export default function WalletAddressPage({
  route,
}: IPageScreenProps<
  IModalWalletAddressParamList,
  EModalWalletAddressRoutes.WalletAddress
>) {
  const { accountId, walletId, indexedAccountId } = route.params;
  const [accountsCreated, setAccountsCreated] = useState(false);
  const [isAllNetworksEnabled, setIsAllNetworksEnabled] = useState<
    Record<string, boolean>
  >({});

  const allNetworksStateInit = useRef(false);

  const [isAllNetworksEnabledWrapper, setIsAllNetworksEnabledWrapper] =
    useState<Record<string, boolean>>({});

  const isOnlyOneNetworkEnabled = useMemo(
    () =>
      Object.values(isAllNetworksEnabledWrapper).filter((o) => o).length === 1,
    [isAllNetworksEnabledWrapper],
  );

  const { result, run: refreshLocalData } = usePromiseResult(
    async () => {
      const networks =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          { accountId, walletId },
        );
      const networkIds = Array.from(
        new Set(
          [
            ...networks.mainnetItems,
            ...networks.testnetItems,
            ...networks.frequentlyUsedItems,
          ].map((o) => o.id),
        ),
      );
      const networksAccount =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
          { networkIds, indexedAccountId },
        );
      return { networksAccount, networks };
    },
    [accountId, indexedAccountId, walletId],
    {
      initResult: {
        networksAccount: [],
        networks: {
          mainnetItems: [],
          testnetItems: [],
          unavailableItems: [],
          frequentlyUsedItems: [],
        },
      },
    },
  );

  const { result: allNetworksState } = usePromiseResult(
    () => backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
    [],
  );

  useEffect(() => {
    if (
      allNetworksStateInit.current ||
      isEmpty([
        ...result.networks.mainnetItems,
        ...result.networks.testnetItems,
      ]) ||
      isNil(allNetworksState)
    ) {
      return;
    }

    allNetworksStateInit.current = true;
    result.networksAccount.forEach((item) => {
      const { network, account } = item;
      setIsAllNetworksEnabledWrapper((prev) => ({
        ...prev,
        [network.id]: account
          ? isEnabledNetworksInAllNetworks({
              networkId: network.id,
              isTestnet: network.isTestnet,
              disabledNetworks: allNetworksState.disabledNetworks,
              enabledNetworks: allNetworksState.enabledNetworks,
            })
          : false,
      }));
    });
  }, [
    allNetworksState,
    result.networks.mainnetItems,
    result.networks.testnetItems,
    result.networksAccount,
  ]);

  const context = useMemo(() => {
    const networkAccountMap: Record<string, INetworkAccount> = {};
    const networkDeriveTypeMap: Record<string, IAccountDeriveTypes> = {};
    for (let i = 0; i < result.networksAccount.length; i += 1) {
      const item = result.networksAccount[i];
      const { network, account, accountDeriveType } = item;
      if (account) {
        networkAccountMap[network.id] = account;
      }
      networkDeriveTypeMap[network.id] = accountDeriveType;
    }
    return {
      networkAccountMap,
      networkDeriveTypeMap,
      initAllNetworksState: allNetworksState,
      accountId,
      indexedAccountId,
      refreshLocalData,
      accountsCreated,
      setAccountsCreated,
      isAllNetworksEnabled,
      setIsAllNetworksEnabled,
      isAllNetworksEnabledWrapper,
      setIsAllNetworksEnabledWrapper,
      isOnlyOneNetworkEnabled,
    } as IWalletAddressContext;
  }, [
    allNetworksState,
    accountId,
    indexedAccountId,
    refreshLocalData,
    accountsCreated,
    isAllNetworksEnabled,
    isAllNetworksEnabledWrapper,
    isOnlyOneNetworkEnabled,
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
        <WalletAddress
          accountId={accountId} // route.params.accountId
          testnetItems={result.networks.testnetItems}
          mainnetItems={result.networks.mainnetItems}
          frequentlyUsedNetworks={result.networks.frequentlyUsedItems}
        />
      </WalletAddressContext.Provider>
    </AccountSelectorProviderMirror>
  );
}
