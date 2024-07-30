import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Icon,
  ListView,
  Page,
  Spinner,
  Stack,
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalWalletAddressRoutes,
  IModalWalletAddressParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';

const DeriveTypesAddressContent = createContext<{
  network?: IServerNetwork;
  refreshLocalData?: () => void;
  walletId: string;
  indexedAccountId: string;
  actionType?: EDeriveAddressActionType;
  onSelected?: ({
    account,
    deriveInfo,
    deriveType,
  }: {
    account: INetworkAccount;
    deriveInfo: IAccountDeriveInfo;
    deriveType: IAccountDeriveTypes;
  }) => void;
}>({
  walletId: '',
  indexedAccountId: '',
  actionType: EDeriveAddressActionType.Copy,
});

type IDeriveTypesAddressItemType = {
  account?: INetworkAccount;
  deriveInfo: IAccountDeriveInfo;
  deriveType: IAccountDeriveTypes;
};

const DeriveTypesAddressItem = ({
  item,
}: {
  item: IDeriveTypesAddressItemType;
}) => {
  const intl = useIntl();
  const copyAccountAddress = useCopyAccountAddress();
  const [loading, setLoading] = useState(false);
  const {
    network,
    refreshLocalData,
    walletId,
    indexedAccountId,
    actionType,
    onSelected,
  } = useContext(DeriveTypesAddressContent);
  const subtitle = item.account
    ? accountUtils.shortenAddress({ address: item.account.address })
    : intl.formatMessage({ id: ETranslations.wallet_no_address });

  const onPress = useCallback(async () => {
    if (item.account) {
      if (!network) {
        throw new Error('network is empty');
      }

      if (actionType === EDeriveAddressActionType.Copy) {
        await copyAccountAddress({
          accountId: item.account.id,
          networkId: network.id,
          deriveType: item.deriveType,
        });
      } else if (actionType === EDeriveAddressActionType.Select) {
        onSelected?.({
          account: item.account,
          deriveInfo: item.deriveInfo,
          deriveType: item.deriveType,
        });
      }
    } else {
      try {
        setLoading(true);
        if (!network) {
          throw new Error('wrong network');
        }
        await backgroundApiProxy.serviceAccount.addHDOrHWAccounts({
          walletId,
          indexedAccountId,
          deriveType: item.deriveType,
          networkId: network.id,
        });
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_success }),
        });
        refreshLocalData?.();
      } finally {
        setLoading(false);
      }
    }
  }, [
    item.account,
    item.deriveType,
    item.deriveInfo,
    network,
    actionType,
    copyAccountAddress,
    onSelected,
    walletId,
    indexedAccountId,
    intl,
    refreshLocalData,
  ]);
  return (
    <ListItem
      title={item.deriveInfo.label}
      subtitle={subtitle}
      renderAvatar={
        <NetworkAvatarBase logoURI={network?.logoURI ?? ''} size="$10" />
      }
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <Stack p="$0.5">
          <Spinner />
        </Stack>
      ) : null}
      {!loading && actionType === EDeriveAddressActionType.Copy ? (
        <Icon
          name={item.account ? 'Copy3Outline' : 'PlusLargeOutline'}
          color="$iconSubdued"
        />
      ) : null}
    </ListItem>
  );
};

const DeriveTypesAddress = ({
  items,
}: {
  items: IDeriveTypesAddressItemType[];
}) => {
  const renderItem = useCallback(
    ({ item }: { item: IDeriveTypesAddressItemType }) => (
      <DeriveTypesAddressItem item={item} />
    ),
    [],
  );
  return (
    <Stack flex={1}>
      <ListView data={items} renderItem={renderItem} />
    </Stack>
  );
};

export default function DeriveTypesAddressPage({
  route,
}: IPageScreenProps<
  IModalWalletAddressParamList,
  EModalWalletAddressRoutes.DeriveTypesAddress
>) {
  const intl = useIntl();
  const {
    indexedAccountId,
    networkId,
    walletId,
    actionType,
    onUnmounted,
    onSelected,
  } = route.params;
  const { result, run: refreshLocalData } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId,
          indexedAccountId,
        },
      ),
    [networkId, indexedAccountId],
  );
  const context = useMemo(
    () => ({
      network: result?.network,
      refreshLocalData,
      walletId,
      indexedAccountId,
      actionType,
      onSelected,
    }),
    [
      result?.network,
      refreshLocalData,
      walletId,
      indexedAccountId,
      actionType,
      onSelected,
    ],
  );
  return (
    <DeriveTypesAddressContent.Provider value={context}>
      <Page onUnmounted={onUnmounted}>
        <Page.Header
          title={intl.formatMessage({ id: ETranslations.address_type })}
        />
        <Page.Body>
          <DeriveTypesAddress items={result?.networkAccounts ?? []} />
        </Page.Body>
      </Page>
    </DeriveTypesAddressContent.Provider>
  );
}
