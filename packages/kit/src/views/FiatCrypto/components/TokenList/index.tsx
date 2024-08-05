import { type FC, useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Badge,
  Empty,
  ListView,
  NumberSizeableText,
  SearchBar,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalFiatCryptoParamList } from '@onekeyhq/shared/src/routes';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { useGetNetwork } from '../NetworkContainer';
import { TokenDataContext, useTokenDataContext } from '../TokenDataContainer';

type ITokenListProps = {
  items: IFiatCryptoToken[];
  onPress?: (params: {
    token: IFiatCryptoToken;
    realAccountId?: string;
  }) => void;
};

const keyExtractor = (item: unknown) => {
  const address = (item as IFiatCryptoToken).address;
  const networkId = (item as IFiatCryptoToken).networkId;
  return `${networkId}--${address || 'main'}`;
};

const ListItemFiatToken = ({
  item,
  onPress,
}: {
  item: IFiatCryptoToken;
  onPress?: (params: {
    token: IFiatCryptoToken;
    realAccountId?: string;
  }) => void;
}) => {
  const intl = useIntl();
  const { networkId, accountId } = useContext(TokenDataContext);
  const { createAddress } = useAccountSelectorCreateAddress();
  const [loading, setLoading] = useState(false);
  const { account } = useAccountData({ networkId, accountId });
  const network = useGetNetwork({ networkId: item.networkId });
  const { fiatMap } = useTokenDataContext();
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  const appNavigation =
    useAppNavigation<
      IPageNavigationProp<
        IModalFiatCryptoParamList,
        EModalFiatCryptoRoutes.BuyModal
      >
    >();

  const handlePress = useCallback(async () => {
    if (
      !networkUtils.isAllNetwork({ networkId }) ||
      !account?.indexedAccountId
    ) {
      onPress?.({ token: item, realAccountId: accountId });
      return;
    }
    if (item.networkId === getNetworkIdsMap().btc) {
      appNavigation.push(EModalFiatCryptoRoutes.DeriveTypesAddress, {
        networkId: item.networkId,
        indexedAccountId: account.indexedAccountId,
        accountId,
        actionType: EDeriveAddressActionType.Select,
        tokenMap: fiatMap,
        onSelected: async ({
          account: networkAccount,
        }: {
          account: INetworkAccount;
        }) => {
          onPress?.({ realAccountId: networkAccount.id, token: item });
        },
      });
    } else {
      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: item.networkId,
        });
      try {
        const dbAccount =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: undefined,
            indexedAccountId: account.indexedAccountId,
            networkId: item.networkId,
            deriveType,
          });
        onPress?.({ token: item, realAccountId: dbAccount.id });
      } catch {
        setLoading(true);
        try {
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: account.indexedAccountId,
          });
          await createAddress({
            selectAfterCreate: true,
            num: 0,
            account: {
              walletId,
              indexedAccountId: account.indexedAccountId,
              deriveType,
              networkId: item.networkId,
            },
          });
          const dbAccount =
            await backgroundApiProxy.serviceAccount.getNetworkAccount({
              accountId: undefined,
              indexedAccountId: account.indexedAccountId,
              networkId: item.networkId,
              deriveType,
            });
          if (dbAccount) {
            onPress?.({ token: item, realAccountId: dbAccount.id });
          }
        } finally {
          setLoading(false);
        }
      }
    }
  }, [
    onPress,
    item,
    networkId,
    account,
    accountId,
    appNavigation,
    fiatMap,
    createAddress,
  ]);

  return (
    <ListItem userSelect="none" onPress={handlePress}>
      <Token
        size="lg"
        tokenImageUri={item.icon}
        networkImageUri={network?.logoURI}
      />
      <ListItem.Text
        flex={1}
        primary={
          <XStack alignItems="center">
            <SizableText size="$bodyLgMedium">{item.symbol}</SizableText>
            <Stack ml="$2">
              <Badge badgeType="default" badgeSize="sm">
                {network?.name}
              </Badge>
            </Stack>
          </XStack>
        }
        secondary={item.name}
      />
      <YStack alignItems="flex-end">
        {loading ? (
          <XStack alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued" pr="$2">
              {intl.formatMessage({
                id: ETranslations.global_creating_address,
              })}
            </SizableText>
            <Spinner size="small" />
          </XStack>
        ) : (
          <YStack alignItems="flex-end">
            {item.balanceParsed ? (
              <NumberSizeableText size="$bodyLgMedium" formatter="balance">
                {item.balanceParsed}
              </NumberSizeableText>
            ) : null}
            {item.fiatValue ? (
              <NumberSizeableText
                size="$bodyMd"
                formatter="balance"
                color="$textSubdued"
                formatterOptions={{
                  currency: symbol,
                }}
              >
                {item.fiatValue}
              </NumberSizeableText>
            ) : null}
          </YStack>
        )}
      </YStack>
    </ListItem>
  );
};

export const TokenList: FC<ITokenListProps> = ({ items, onPress }) => {
  const [text, setText] = useState('');
  const onChangeText = useCallback((value: string) => {
    setText(value.trim());
  }, []);

  const data = useMemo(() => {
    const key = text.toLowerCase();
    return items.filter(
      (o) =>
        o.name.toLowerCase().includes(key) ||
        o.symbol.toLowerCase().includes(text),
    );
  }, [items, text]);
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();

  return (
    <Stack flex={1}>
      <Stack px="$5" pb="$4">
        <SearchBar
          placeholder={intl.formatMessage({
            id: ETranslations.global_search_tokens,
          })}
          value={text}
          onChangeText={onChangeText}
        />
      </Stack>
      <Stack flex={1}>
        <ListView
          estimatedItemSize={60}
          data={data}
          renderItem={({ item }) => (
            <ListItemFiatToken item={item} onPress={onPress} />
          )}
          keyExtractor={keyExtractor}
          ListFooterComponent={<Stack h={bottom || '$2'} />}
          ListEmptyComponent={
            <Empty
              title={intl.formatMessage({
                id: ETranslations.global_no_results,
              })}
              icon="SearchOutline"
            />
          }
        />
      </Stack>
    </Stack>
  );
};
