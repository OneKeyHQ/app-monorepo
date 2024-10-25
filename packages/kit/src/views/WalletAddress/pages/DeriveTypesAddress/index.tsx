import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { find } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Icon,
  ListView,
  NumberSizeableText,
  Page,
  Spinner,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useCopyAccountAddress } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import {
  EAccountSelectorSceneName,
  type IServerNetwork,
} from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

const DeriveTypesAddressContent = createContext<{
  network?: IServerNetwork;
  refreshLocalData?: () => void;
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
  token?: IToken;
  tokenMap?: Record<string, ITokenFiat>;
}>({
  indexedAccountId: '',
  actionType: EDeriveAddressActionType.Copy,
  tokenMap: {},
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
    indexedAccountId,
    actionType,
    onSelected,
    token,
    tokenMap,
  } = useContext(DeriveTypesAddressContent);
  const { createAddress } = useAccountSelectorCreateAddress();

  const [settings] = useSettingsPersistAtom();
  let tokenFiat: ITokenFiat | undefined;

  if (tokenMap) {
    tokenFiat = find(
      tokenMap,
      (_, key) =>
        !!(
          (item.account as IDBUtxoAccount)?.xpub &&
          key.includes((item.account as IDBUtxoAccount)?.xpub)
        ),
    );
  }

  const subtitle = item.account
    ? accountUtils.shortenAddress({ address: item.account.address })
    : intl.formatMessage({ id: ETranslations.wallet_no_address });

  const onPress = useCallback(async () => {
    if (!network) {
      throw new Error('network is empty');
    }
    if (item.account) {
      if (actionType === EDeriveAddressActionType.Copy) {
        await copyAccountAddress({
          accountId: item.account.id,
          networkId: network.id,
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
        const walletId = accountUtils.getWalletIdFromAccountId({
          accountId: indexedAccountId,
        });
        const createAddressResult = await createAddress({
          selectAfterCreate: false,
          num: 0,
          account: {
            walletId,
            indexedAccountId,
            deriveType: item.deriveType,
            networkId: network.id,
          },
        });
        if (createAddressResult) {
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.swap_page_toast_address_generated,
            }),
          });
        }
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
    indexedAccountId,
    intl,
    refreshLocalData,
    createAddress,
  ]);
  return (
    <ListItem
      title={item.deriveInfo.label}
      subtitle={subtitle}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={network?.logoURI ?? ''}
          isCustomNetwork={network?.isCustomNetwork}
          networkName={network?.name}
          size="$8"
        />
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
      {!loading &&
      actionType === EDeriveAddressActionType.Select &&
      item.account ? (
        <YStack>
          <NumberSizeableText
            formatter="balance"
            formatterOptions={{ tokenSymbol: token?.symbol }}
            numberOfLines={1}
            textAlign="right"
            size="$bodyLgMedium"
          >
            {tokenFiat?.balanceParsed ?? 0}
          </NumberSizeableText>
          <NumberSizeableText
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            size="$bodyMd"
            color="$textSubdued"
            textAlign="right"
          >
            {tokenFiat?.fiatValue ?? 0}
          </NumberSizeableText>
        </YStack>
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
      <ListView data={items} estimatedItemSize={60} renderItem={renderItem} />
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
    actionType,
    onUnmounted,
    onSelected,
    token,
    tokenMap,
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
      indexedAccountId,
      actionType,
      onSelected,
      tokenMap,
      token,
    }),
    [
      result?.network,
      refreshLocalData,
      indexedAccountId,
      actionType,
      onSelected,
      tokenMap,
      token,
    ],
  );
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
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
    </AccountSelectorProviderMirror>
  );
}
