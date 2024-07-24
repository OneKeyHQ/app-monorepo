import { createContext, useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Page,
  SearchBar,
  SectionList,
  Stack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalWalletAddressRoutes,
  IModalWalletAddressParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

const WalletAddressContext = createContext<{
  networkAccountMap: Record<string, INetworkAccount>;
}>({ networkAccountMap: {} });

type ISectionItem = {
  title?: string;
  data: IServerNetwork[];
};

const CELL_HEIGHT = 48;

const WalletAddressListItem = ({ item }: { item: IServerNetwork }) => {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const { networkAccountMap } = useContext(WalletAddressContext);
  const account = networkAccountMap[item.id] as INetworkAccount | undefined;
  const subtitle = account
    ? accountUtils.shortenAddress({ address: account.address })
    : intl.formatMessage({ id: ETranslations.wallet_no_address });

  const onPress = useCallback(() => {
    if (account) {
      copyText(account.address);
    } else {
      // create address
    }
  }, [account, copyText]);
  return (
    <ListItem
      title={item.name}
      subtitle={subtitle}
      h={CELL_HEIGHT}
      renderAvatar={<NetworkAvatarBase logoURI={item.logoURI} size="$8" />}
    >
      <ListItem.IconButton
        icon={account ? 'Copy1Outline' : 'PlusLargeOutline'}
        size="small"
        onPress={onPress}
      />
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
  const sections = useMemo<ISectionItem[]>(() => {
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
  }, [networks, frequentlyUsedNetworks]);

  const renderSectionHeader = useCallback(
    (item: { section: { title: string } }) => {
      if (item?.section?.title) {
        return <SectionList.SectionHeader title={item?.section?.title} />;
      }
      return <Stack h="$2" />;
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
            id: ETranslations.global_search,
          })}
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
}) => (
  <Page>
    <Page.Header title="Wallet Address" />
    <Page.Body>
      <WalletAddressContent
        networks={networks}
        frequentlyUsedNetworks={frequentlyUsedNetworks}
      />
    </Page.Body>
  </Page>
);

export default function WalletAddressPage({
  route,
}: IPageScreenProps<
  IModalWalletAddressParamList,
  EModalWalletAddressRoutes.WalletAddress
>) {
  const { accountId, indexedAccountId } = route.params;
  const { result } = usePromiseResult(
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
    return { networkAccountMap };
  }, [result.networksAccount]);

  return (
    <WalletAddressContext.Provider value={context}>
      <WalletAddress
        networks={result.networks.networks}
        frequentlyUsedNetworks={result.networks.frequentlyUsedNetworks}
      />
    </WalletAddressContext.Provider>
  );
}
