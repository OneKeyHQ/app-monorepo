import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import type {
  IPageNavigationProp,
  IPageScreenProps,
} from '@onekeyhq/components';
import {
  Icon,
  Page,
  SearchBar,
  SectionList,
  Spinner,
  Stack,
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { networkFuseSearch } from '@onekeyhq/kit/src/views/ChainSelector/utils';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalWalletAddressRoutes,
  type IModalWalletAddressParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

const WalletAddressContext = createContext<{
  networkAccountMap: Record<string, INetworkAccount>;
  accountId?: string;
  indexedAccountId: string;
  walletId: string;
  deriveType?: IAccountDeriveTypes;
  deriveInfo?: IAccountDeriveInfo;
  refreshLocalData: () => void;
}>({
  networkAccountMap: {},
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

const WalletAddressListItem = ({ item }: { item: IServerNetwork }) => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const copyAccountAddress = useCopyAccountAddress();
  const {
    networkAccountMap,
    walletId,
    indexedAccountId,
    deriveType,
    deriveInfo,
    refreshLocalData,
  } = useContext(WalletAddressContext);
  const account = networkAccountMap[item.id] as INetworkAccount | undefined;
  const subtitle = account
    ? accountUtils.shortenAddress({ address: account.address })
    : intl.formatMessage({
        id: ETranslations.copy_address_modal_item_create_address_instruction,
      });

  const onPress = useCallback(async () => {
    if (!deriveType || !deriveInfo) {
      throw Error('deriveType / deriveInfo must not be empty');
    }
    if (account) {
      await copyAccountAddress({
        accountId: account.id,
        networkId: item.id,
        deriveType,
        deriveInfo,
      });
    } else {
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
    deriveInfo,
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
        <Icon
          name={account ? 'Copy3Outline' : 'PlusLargeOutline'}
          color="$iconSubdued"
        />
      )}
    </ListItem>
  );
};

const WalletAddressContent = ({
  networks,
  frequentlyUsedNetworks,
}: {
  networks: IServerNetwork[];
  frequentlyUsedNetworks: IServerNetwork[];
}) => {
  const intl = useIntl();
  const [searchText, setSearchText] = useState('');
  const sections = useMemo<ISectionItem[]>(() => {
    const searchTextTrim = searchText.trim();
    if (searchTextTrim) {
      const data = networkFuseSearch(networks, searchTextTrim);
      return data.length === 0
        ? []
        : [
            {
              data,
            },
          ];
    }
    const data = networks.reduce((result, item) => {
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
    return _sections;
  }, [networks, frequentlyUsedNetworks, searchText]);

  const renderSectionHeader = useCallback(
    (item: { section: { title: string } }) => {
      if (item?.section?.title) {
        return <SectionList.SectionHeader title={item?.section?.title} />;
      }
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
      <Stack px="$5" pb="$4">
        <SearchBar
          placeholder={intl.formatMessage({
            id: ETranslations.global_search,
          })}
          value={searchText}
          onChangeText={(text) => setSearchText(text)}
        />
      </Stack>
      <SectionList
        sections={sections}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
      />
    </Stack>
  );
};

const WalletAddress = ({
  networks,
  frequentlyUsedNetworks,
}: {
  networks: IServerNetwork[];
  frequentlyUsedNetworks: IServerNetwork[];
}) => {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.copy_address_modal_title,
        })}
      />
      <Page.Body>
        <WalletAddressContent
          networks={networks}
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
  const { accountId, indexedAccountId, walletId, deriveType, deriveInfo } =
    route.params;
  const { result, run: refreshLocalData } = usePromiseResult(
    async () => {
      const networks =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          { accountId },
        );
      const networkIds = Array.from(
        new Set(
          [...networks.networks, ...networks.frequentlyUsedNetworks].map(
            (o) => o.id,
          ),
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
          networks: [],
          unavailableNetworks: [],
          frequentlyUsedNetworks: [],
        },
      },
    },
  );

  const context = useMemo(() => {
    const networkAccountMap = result.networksAccount.reduce((acc, item) => {
      const { network, account } = item;
      if (account) {
        acc[network.id] = account;
      }
      return acc;
    }, {} as Record<string, INetworkAccount>);
    return {
      networkAccountMap,
      walletId,
      deriveType,
      accountId,
      indexedAccountId,
      refreshLocalData,
      deriveInfo,
    };
  }, [
    result.networksAccount,
    walletId,
    deriveType,
    indexedAccountId,
    accountId,
    refreshLocalData,
    deriveInfo,
  ]);

  return (
    <WalletAddressContext.Provider value={context}>
      <WalletAddress
        networks={result.networks.networks}
        frequentlyUsedNetworks={result.networks.frequentlyUsedNetworks}
      />
    </WalletAddressContext.Provider>
  );
}
