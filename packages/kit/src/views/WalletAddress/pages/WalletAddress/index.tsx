import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import type {
  IKeyOfIcons,
  IPageNavigationProp,
  IPageScreenProps,
} from '@onekeyhq/components';
import {
  Empty,
  Icon,
  Page,
  SearchBar,
  SectionList,
  Spinner,
  Stack,
  Toast,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useFuseSearch } from '@onekeyhq/kit/src/views/ChainSelector/hooks/useFuseSearch';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalWalletAddressRoutes,
  type IModalWalletAddressParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';

type IWalletAddressContext = {
  networkAccountMap: Record<string, INetworkAccount>;
  networkDeriveTypeMap: Record<string, IAccountDeriveTypes>;
  accountId?: string;
  indexedAccountId: string;
  walletId: string;
  refreshLocalData: () => void;
};

const WalletAddressContext = createContext<IWalletAddressContext>({
  networkAccountMap: {},
  networkDeriveTypeMap: {},
  accountId: '',
  indexedAccountId: '',
  walletId: '',
  refreshLocalData: () => {},
});

type ISectionItem = {
  title?: string;
  data: IServerNetwork[];
};

const WalletAddressDeriveTypeItem = ({ item }: { item: IServerNetwork }) => {
  const appNavigation =
    useAppNavigation<IPageNavigationProp<IModalWalletAddressParamList>>();
  const intl = useIntl();
  const { walletId, indexedAccountId, accountId } =
    useContext(WalletAddressContext);

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
  const onPress = useCallback(() => {
    appNavigation.push(EModalWalletAddressRoutes.DeriveTypesAddress, {
      networkId: item.id,
      walletId,
      indexedAccountId,
      accountId,
      actionType: EDeriveAddressActionType.Copy,
      onUnmounted: onRefreshData,
    });
  }, [
    appNavigation,
    walletId,
    indexedAccountId,
    accountId,
    item.id,
    onRefreshData,
  ]);

  const subtitle = useMemo(() => {
    let text = intl.formatMessage({
      id: ETranslations.copy_address_modal_item_create_address_instruction,
    });
    const count = result
      ? result.networkAccounts.filter((o) => o.account).length
      : 0;
    if (count > 0) {
      text = intl.formatMessage(
        { id: ETranslations.global_count_addresses },
        { count },
      );
    }
    return text;
  }, [intl, result]);

  return (
    <ListItem
      title={item.name}
      subtitle={subtitle}
      onPress={onPress}
      renderAvatar={<NetworkAvatarBase logoURI={item.logoURI} size="$10" />}
    >
      <Icon name="ChevronRightOutline" color="$iconSubdued" />
    </ListItem>
  );
};

const WalletAddressListItemIcon = ({
  account,
}: {
  account?: INetworkAccount;
}) => {
  let name: IKeyOfIcons | undefined;
  if (!account) {
    name = 'PlusLargeOutline';
  } else if (account && account.address) {
    name = 'Copy3Outline';
  }
  return name ? (
    <Icon
      name={account ? 'Copy3Outline' : 'PlusLargeOutline'}
      color="$iconSubdued"
    />
  ) : null;
};

const WalletAddressListItem = ({ item }: { item: IServerNetwork }) => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const copyAccountAddress = useCopyAccountAddress();
  const {
    networkAccountMap,
    networkDeriveTypeMap,
    walletId,
    indexedAccountId,
    refreshLocalData,
  } = useContext(WalletAddressContext);
  const deriveType = networkDeriveTypeMap[item.id] || 'default';
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
        await backgroundApiProxy.serviceAccount.addHDOrHWAccounts({
          walletId,
          indexedAccountId,
          deriveType,
          networkId: item.id,
        });
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_success }),
        });
        refreshLocalData();
      } finally {
        setLoading(false);
      }
    } else if (account && account.address) {
      await copyAccountAddress({
        accountId: account.id,
        networkId: item.id,
        deriveType,
      });
    }
  }, [
    account,
    walletId,
    indexedAccountId,
    deriveType,
    item.id,
    refreshLocalData,
    intl,
    copyAccountAddress,
  ]);

  if (item.id === getNetworkIdsMap().btc) {
    return <WalletAddressDeriveTypeItem item={item} />;
  }
  return (
    <ListItem
      title={item.name}
      subtitle={subtitle}
      renderAvatar={<NetworkAvatarBase logoURI={item.logoURI} size="$10" />}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <Stack p="$0.5">
          <Spinner />
        </Stack>
      ) : (
        <WalletAddressListItemIcon account={account} />
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

  const networkFuseSearch = useFuseSearch(mainnetItems);
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
    const data = mainnetItems.reduce((result, item) => {
      const char = item.name[0].toUpperCase();
      if (!result[char]) {
        result[char] = [];
      }
      result[char].push(item);

      return result;
    }, {} as Record<string, IServerNetwork[]>);
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
        data: testnetItems,
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
  mainnetItems,
  testnetItems,
  frequentlyUsedNetworks,
}: {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  frequentlyUsedNetworks: IServerNetwork[];
}) => {
  const intl = useIntl();

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
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
  const { accountId, indexedAccountId, walletId } = route.params;
  const { result, run: refreshLocalData } = usePromiseResult(
    async () => {
      const networks =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          { accountId },
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
    [accountId, indexedAccountId],
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
      walletId,
      accountId,
      indexedAccountId,
      refreshLocalData,
    } as IWalletAddressContext;
  }, [
    result.networksAccount,
    walletId,
    indexedAccountId,
    accountId,
    refreshLocalData,
  ]);

  return (
    <WalletAddressContext.Provider value={context}>
      <WalletAddress
        testnetItems={result.networks.testnetItems}
        mainnetItems={result.networks.mainnetItems}
        frequentlyUsedNetworks={result.networks.frequentlyUsedItems}
      />
    </WalletAddressContext.Provider>
  );
}
