import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { differenceBy, isEmpty, isEqual, isNil } from 'lodash';
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
import type { IAllNetworksDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAllNetworks';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
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
import debugUtils from '@onekeyhq/shared/src/utils/debugUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/perfUtils';
import {
  EAccountSelectorSceneName,
  type IServerNetwork,
} from '@onekeyhq/shared/types';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';

type IIsAllNetworksEnabledWrapperMap = {
  [networkId: string]: boolean;
};

type IWalletAddressContext = {
  networkAccountMap: Record<string, IAllNetworkAccountInfo[]>;
  networkDeriveTypeMap: Record<string, IAccountDeriveTypes[]>;
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
  setIsAllNetworksEnabledWrapper: (
    fn: (
      data: IIsAllNetworksEnabledWrapperMap,
    ) => IIsAllNetworksEnabledWrapperMap,
  ) => void;
  isOnlyOneNetworkEnabled: boolean;
};

const log = debugUtils.createSimpleDebugLog('<WalletAddressPage>', true);

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

function WalletAddressDeriveTypeItem({ network }: { network: IServerNetwork }) {
  const appNavigation =
    useAppNavigation<IPageNavigationProp<IModalWalletAddressParamList>>();
  const intl = useIntl();
  const {
    networkAccountMap,
    indexedAccountId,
    initAllNetworksState,
    isAllNetworksEnabled,
    setIsAllNetworksEnabled,
    setIsAllNetworksEnabledWrapper,
    isOnlyOneNetworkEnabled,
    refreshLocalData,
  } = useContext(WalletAddressContext);

  const memoData = useMemo(() => {
    const networkAccounts = networkAccountMap[network.id];
    const deriveAccounts = networkAccounts ?? [];
    const isDeriveAccountsInitialized = !isNil(networkAccounts);
    const deriveAccountsEnabledCount = deriveAccounts.filter(
      (a) => a.dbAccount,
    ).length;

    return {
      deriveAccountsEnabledCount,
      networkAccounts,
      deriveAccounts,
      isDeriveAccountsInitialized,
    };
  }, [networkAccountMap, network.id]);

  const {
    deriveAccountsEnabledCount,
    networkAccounts,
    deriveAccounts,
    isDeriveAccountsInitialized,
  } = memoData;

  const isEnabledNetworkFromDB = useMemo(
    () =>
      isEnabledNetworksInAllNetworks({
        networkId: network.id,
        isTestnet: network.isTestnet,
        disabledNetworks: initAllNetworksState.disabledNetworks,
        enabledNetworks: initAllNetworksState.enabledNetworks,
      }),
    [
      initAllNetworksState.disabledNetworks,
      initAllNetworksState.enabledNetworks,
      network.id,
      network.isTestnet,
    ],
  );

  const isEnabledNetwork = useMemo(
    () => isAllNetworksEnabled[network.id] ?? isEnabledNetworkFromDB,
    [isAllNetworksEnabled, isEnabledNetworkFromDB, network.id],
  );

  useEffect(() => {
    // TODO performance, update at top
    setIsAllNetworksEnabledWrapper((prev: IIsAllNetworksEnabledWrapperMap) => ({
      ...prev,
      [network.id]: deriveAccountsEnabledCount > 0 ? isEnabledNetwork : false,
    }));
  }, [
    isEnabledNetwork,
    network.id,
    setIsAllNetworksEnabledWrapper,
    deriveAccountsEnabledCount,
  ]);

  const onPress = useCallback(() => {
    appNavigation.push(EModalWalletAddressRoutes.DeriveTypesAddress, {
      networkId: network.id,
      indexedAccountId,
      onUnmounted: refreshLocalData,
      actionType: EDeriveAddressActionType.Copy,
    });
  }, [appNavigation, indexedAccountId, network.id, refreshLocalData]);

  const isEnabled = useMemo(
    () => !isDeriveAccountsInitialized || deriveAccountsEnabledCount > 0,
    [deriveAccountsEnabledCount, isDeriveAccountsInitialized],
  );

  const subtitle = useMemo(
    () =>
      isEnabled
        ? intl.formatMessage(
            { id: ETranslations.global_count_addresses },
            { count: deriveAccountsEnabledCount },
          )
        : intl.formatMessage({
            id: ETranslations.copy_address_modal_item_create_address_instruction,
          }),
    [isEnabled, intl, deriveAccountsEnabledCount],
  );

  const eyeIcon = useMemo(() => {
    if (isEnabled) {
      return (
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
            if (network.isTestnet) return;
            setIsAllNetworksEnabled((prev) => ({
              ...prev,
              [network.id]: !isEnabledNetwork,
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
                  networkId: network.id,
                });
              });
            } else {
              deriveAccounts.forEach((a) => {
                enabledNetworks.push({
                  networkId: network.id,
                });
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
      );
    }
    return null;
  }, [
    isEnabled,
    isOnlyOneNetworkEnabled,
    isEnabledNetwork,
    network.isTestnet,
    network.name,
    network.id,
    intl,
    setIsAllNetworksEnabled,
    deriveAccounts,
  ]);

  const copyIcon = useMemo(
    () => (
      <Icon
        name={isEnabled ? 'Copy3Outline' : 'PlusLargeOutline'}
        color="$iconSubdued"
      />
    ),
    [isEnabled],
  );

  const avatar = useMemo(
    () => (
      <NetworkAvatarBase
        logoURI={network.logoURI}
        isCustomNetwork={network.isCustomNetwork}
        networkName={network.name}
        size="$10"
      />
    ),
    [network.isCustomNetwork, network.logoURI, network.name],
  );

  return useMemo(
    () => (
      <ListItem
        title={network.name}
        subtitle={subtitle}
        onPress={onPress}
        renderAvatar={avatar}
      >
        <XStack gap="$6" alignItems="center">
          {eyeIcon}
          {copyIcon}
        </XStack>
      </ListItem>
    ),
    [avatar, copyIcon, eyeIcon, network.name, onPress, subtitle],
  );
}

const WalletAddressDeriveTypeItemMemo = memo(WalletAddressDeriveTypeItem);

function WalletAddressListItemIcon({
  account,
  network,
  isEnabledNetwork,
}: {
  account?: IAllNetworkAccountInfo;
  network: IServerNetwork;
  isEnabledNetwork: boolean;
}) {
  const {
    setIsAllNetworksEnabled,
    setIsAllNetworksEnabledWrapper,
    isOnlyOneNetworkEnabled,
  } = useContext(WalletAddressContext);
  const intl = useIntl();

  useEffect(() => {
    // TODO performance, update at top
    setIsAllNetworksEnabledWrapper((prev) => ({
      ...prev,
      [network.id]: account ? isEnabledNetwork : false,
    }));
  }, [isEnabledNetwork, network.id, setIsAllNetworksEnabledWrapper, account]);

  const onPressEyeIcon = useCallback(async () => {
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
  }, [
    isEnabledNetwork,
    network.id,
    network.name,
    intl,
    setIsAllNetworksEnabled,
  ]);

  const eyeIcon = useMemo(() => {
    if (!account) {
      return null;
    }
    return (
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
        onPress={onPressEyeIcon}
      />
    );
  }, [
    account,
    intl,
    isEnabledNetwork,
    isOnlyOneNetworkEnabled,
    network.isTestnet,
    onPressEyeIcon,
  ]);

  if (!account) {
    return <Icon name="PlusLargeOutline" color="$iconSubdued" />;
  }

  return (
    <XStack gap="$6" alignItems="center">
      {eyeIcon}
      <Icon name="Copy3Outline" color="$iconSubdued" />
    </XStack>
  );
}
const WalletAddressListItemIconMemo = memo(WalletAddressListItemIcon);

function SingleWalletAddressListItem({ network }: { network: IServerNetwork }) {
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

  const isEnabledNetworkFromDB = useMemo(
    () =>
      isEnabledNetworksInAllNetworks({
        networkId: network.id,
        isTestnet: network.isTestnet,
        disabledNetworks: initAllNetworksState.disabledNetworks,
        enabledNetworks: initAllNetworksState.enabledNetworks,
      }),
    [
      initAllNetworksState.disabledNetworks,
      initAllNetworksState.enabledNetworks,
      network.id,
      network.isTestnet,
    ],
  );

  const isEnabledNetwork = useMemo(
    () => isAllNetworksEnabled[network.id] ?? isEnabledNetworkFromDB,
    [isAllNetworksEnabled, isEnabledNetworkFromDB, network.id],
  );

  const copyAccountAddress = useCopyAccountAddress();
  const appNavigation =
    useAppNavigation<IPageNavigationProp<IModalWalletAddressParamList>>();

  const { createAddress } = useAccountSelectorCreateAddress();
  const account = useMemo(
    () => networkAccountMap[network.id]?.[0],
    [networkAccountMap, network.id],
  );
  const subtitle = useMemo(
    () =>
      account
        ? accountUtils.shortenAddress({ address: account.apiAddress })
        : intl.formatMessage({
            id: ETranslations.copy_address_modal_item_create_address_instruction,
          }),
    [account, intl],
  );

  const onPress = useCallback(async () => {
    if (!account) {
      try {
        setLoading(true);
        const { walletId } = accountUtils.parseIndexedAccountId({
          indexedAccountId,
        });
        const globalDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: network.id,
          });
        const deriveType: IAccountDeriveTypes =
          networkDeriveTypeMap?.[network.id]?.[0] ||
          globalDeriveType ||
          'default';
        const createAddressResult = await createAddress({
          account: {
            walletId,
            networkId: network.id,
            indexedAccountId,
            deriveType,
          },
          selectAfterCreate: false,
          num: 0,
        });
        if (createAddressResult) {
          if (!network.isTestnet) {
            setAccountsCreated(true);
            setIsAllNetworksEnabled((prev) => ({
              ...prev,
              [network.id]: true,
            }));
          }
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: [{ networkId: network.id }],
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
    } else if (networkUtils.isLightningNetworkByNetworkId(network.id)) {
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
      });
    }
  }, [
    account,
    network.id,
    network.isTestnet,
    indexedAccountId,
    networkDeriveTypeMap,
    createAddress,
    intl,
    refreshLocalData,
    setAccountsCreated,
    setIsAllNetworksEnabled,
    appNavigation,
    copyAccountAddress,
  ]);

  const avatar = useMemo(
    () => (
      <NetworkAvatarBase
        logoURI={network.logoURI}
        isCustomNetwork={network.isCustomNetwork}
        networkName={network.name}
        size="$10"
      />
    ),
    [network.isCustomNetwork, network.logoURI, network.name],
  );

  return useMemo(
    () => (
      <ListItem
        title={network.name}
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
          <WalletAddressListItemIconMemo
            isEnabledNetwork={isEnabledNetwork}
            account={account}
            network={network}
          />
        )}
      </ListItem>
    ),
    [account, avatar, isEnabledNetwork, loading, network, onPress, subtitle],
  );
}
const SingleWalletAddressListItemMemo = memo(SingleWalletAddressListItem);

function WalletAddressListItem({ network }: { network: IServerNetwork }) {
  if (
    networkUtils.getDefaultDeriveTypeVisibleNetworks().includes(network.id)
    // item.id === getNetworkIdsMap().btc ||
    // item.id === getNetworkIdsMap().ltc
  ) {
    return <WalletAddressDeriveTypeItemMemo network={network} />;
  }
  return <SingleWalletAddressListItemMemo network={network} />;
}
const WalletAddressListItemMemo = memo(WalletAddressListItem);

function WalletAddressContent({
  mainnetItems,
  testnetItems,
  frequentlyUsedNetworks,
}: {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  frequentlyUsedNetworks: IServerNetwork[];
}) {
  log('WalletAddressContentRender');

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
}) {
  const intl = useIntl();
  return (
    <Page safeAreaEnabled={false} onClose={onClose}>
      <Page.Header
        // title={accountId || ''}
        title={intl.formatMessage({
          id: ETranslations.copy_address_modal_title,
        })}
      />
      <Page.Body>{children}</Page.Body>
    </Page>
  );
}

function WalletAddress({
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
}) {
  const intl = useIntl();
  const { initAllNetworksState, accountsCreated } =
    useContext(WalletAddressContext);

  const onClose = useCallback(async () => {
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
      // TODO performance, always emit when Modal open
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
    }
  }, [
    accountsCreated,
    initAllNetworksState.disabledNetworks,
    initAllNetworksState.enabledNetworks,
  ]);

  return (
    <WalletAddressPageView onClose={onClose}>
      <WalletAddressContentMemo
        testnetItems={testnetItems}
        mainnetItems={mainnetItems}
        frequentlyUsedNetworks={frequentlyUsedNetworks}
      />
    </WalletAddressPageView>
  );
}
const WalletAddressMemo = memo(WalletAddress);

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

  // TODO performance what is this?
  const [isAllNetworksEnabledWrapper, setIsAllNetworksEnabledWrapperBase] =
    useState<IIsAllNetworksEnabledWrapperMap>({});

  const setIsAllNetworksEnabledWrapper = useCallback(
    (
      fn: (
        data: IIsAllNetworksEnabledWrapperMap,
      ) => IIsAllNetworksEnabledWrapperMap,
    ) => {
      setIsAllNetworksEnabledWrapperBase((prev) => {
        const newData = fn(prev);
        if (isEqual(prev, newData)) {
          return prev;
        }
        if (process.env.NODE_ENV !== 'production') {
          log('isAllNetworksEnabledWrapperChanged:', {
            prev,
            newData,
            diff: Object.keys(newData)
              .filter((key) => prev[key] !== newData[key])
              .map((key) => ({
                key,
                old: prev[key],
                new: newData[key],
              })),
          });
        }
        return newData;
      });
    },
    [],
  );

  const isOnlyOneNetworkEnabled = useMemo(
    () =>
      Object.values(isAllNetworksEnabledWrapper).filter((o) => o).length === 1,
    [isAllNetworksEnabledWrapper],
  );

  const {
    result,
    run: refreshLocalData,
    isLoading,
  } = usePromiseResult(
    async () => {
      const perf = perfUtils.createPerf(
        EPerformanceTimerLogNames.allNetwork__walletAddressPage,
      );

      perf.markStart('getChainSelectorNetworksCompatibleWithAccountId');
      const networks =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          { accountId, walletId },
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
      return {
        networksAccount,
        networks,
        allNetworksState,
      };
    },
    [accountId, walletId],
    {
      watchLoading: true,
      initResult: {
        networksAccount: [],
        allNetworksState: {
          disabledNetworks: [],
          enabledNetworks: [],
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
    result.networksAccount.forEach((item) => {
      const { networkId, isTestnet, dbAccount } = item;
      if (dbAccount) {
        updateMap[networkId] = isEnabledNetworksInAllNetworks({
          networkId,
          isTestnet,
          disabledNetworks: result.allNetworksState.disabledNetworks,
          enabledNetworks: result.allNetworksState.enabledNetworks,
        });
      } else {
        updateMap[networkId] = false;
      }
    });
    setIsAllNetworksEnabledWrapper((prev) => ({
      ...prev,
      ...updateMap,
    }));
    log('update-isAllNetworksEnabledWrapper');
  }, [
    result.allNetworksState,
    result.networks.mainnetItems,
    result.networks.testnetItems,
    result.networksAccount,
    setIsAllNetworksEnabledWrapper,
  ]);

  const context = useMemo(() => {
    log('contextCalculate');
    const networkAccountMap: Record<string, IAllNetworkAccountInfo[]> = {};
    const networkDeriveTypeMap: Record<string, IAccountDeriveTypes[]> = {};
    for (let i = 0; i < result.networksAccount.length; i += 1) {
      const item = result.networksAccount[i];
      const { networkId, deriveType, dbAccount } = item;
      if (dbAccount) {
        networkAccountMap[networkId] = [
          ...(networkAccountMap[networkId] ?? []),
          item,
        ];
      }
      if (deriveType) {
        networkDeriveTypeMap[networkId] = [
          ...(networkDeriveTypeMap[networkId] ?? []),
          deriveType,
        ];
      }
    }
    const contextData: IWalletAddressContext = {
      networkAccountMap,
      networkDeriveTypeMap,
      initAllNetworksState: result.allNetworksState,
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
    };
    return contextData;
  }, [
    result.allNetworksState,
    result.networksAccount,
    accountId,
    indexedAccountId,
    refreshLocalData,
    accountsCreated,
    isAllNetworksEnabled,
    isAllNetworksEnabledWrapper,
    isOnlyOneNetworkEnabled,
    setIsAllNetworksEnabledWrapper,
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
        {isLoading && !result.networksAccount?.length ? (
          <WalletAddressPageView>
            <Stack p="$5" h="$100" alignItems="center" justifyContent="center">
              <Spinner size="large" />
            </Stack>
          </WalletAddressPageView>
        ) : (
          <WalletAddressMemo
            accountId={accountId} // route.params.accountId
            testnetItems={result.networks.testnetItems}
            mainnetItems={result.networks.mainnetItems}
            frequentlyUsedNetworks={result.networks.frequentlyUsedItems}
          />
        )}
      </WalletAddressContext.Provider>
    </AccountSelectorProviderMirror>
  );
}
