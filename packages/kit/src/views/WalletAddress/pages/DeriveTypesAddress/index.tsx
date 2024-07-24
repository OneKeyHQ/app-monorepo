import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { ListView, Page, Stack, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
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

const DeriveTypesAddressContent = createContext<{
  network?: IServerNetwork;
  refreshLocalData?: () => void;
  walletId: string;
  indexedAccountId: string;
}>({ walletId: '', indexedAccountId: '' });

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
  const { copyText } = useClipboard();
  const [loading, setLoading] = useState(false);
  const { network, refreshLocalData, walletId, indexedAccountId } = useContext(
    DeriveTypesAddressContent,
  );
  const subtitle = item.account
    ? accountUtils.shortenAddress({ address: item.account.address })
    : intl.formatMessage({ id: ETranslations.wallet_no_address });

  const onPress = useCallback(async () => {
    if (item.account) {
      copyText(item.account.address);
    } else {
      try {
        setLoading(true);
        await backgroundApiProxy.serviceAccount.addHDOrHWAccounts({
          walletId,
          indexedAccountId,
          deriveType: item.deriveType,
          networkId: network?.id,
        });
        refreshLocalData?.();
      } finally {
        setLoading(false);
      }
    }
  }, [
    item,
    copyText,
    refreshLocalData,
    indexedAccountId,
    network?.id,
    walletId,
  ]);
  return (
    <ListItem
      title={item.deriveInfo.label}
      subtitle={subtitle}
      renderAvatar={
        <NetworkAvatarBase logoURI={network?.logoURI ?? ''} size="$8" />
      }
    >
      <ListItem.IconButton
        loading={loading}
        icon={item.account ? 'Copy1Outline' : 'PlusLargeOutline'}
        size="small"
        onPress={onPress}
      />
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

export default function WalletAddressPage({
  route,
}: IPageScreenProps<
  IModalWalletAddressParamList,
  EModalWalletAddressRoutes.DeriveTypesAddress
>) {
  const { indexedAccountId, networkId, walletId } = route.params;
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
    }),
    [result?.network, refreshLocalData, walletId, indexedAccountId],
  );
  return (
    <DeriveTypesAddressContent.Provider value={context}>
      <Page>
        <Page.Header title="Derive Types" />
        <Page.Body>
          <DeriveTypesAddress items={result?.networkAccounts ?? []} />
        </Page.Body>
      </Page>
    </DeriveTypesAddressContent.Provider>
  );
}
