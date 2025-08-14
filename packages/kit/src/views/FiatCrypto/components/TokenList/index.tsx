import { type FC, useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

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
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { useGetNetwork } from '../NetworkContainer';
import { TokenDataContext } from '../TokenDataContainer';

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

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const walletId = useMemo(
    () => accountUtils.getWalletIdFromAccountId({ accountId: accountId ?? '' }),
    [accountId],
  );

  const { vaultSettings } = useAccountData({ networkId: item.networkId });

  const handlePress = useCallback(async () => {
    if (
      !networkUtils.isAllNetwork({ networkId }) ||
      !account?.indexedAccountId
    ) {
      onPress?.({ token: item, realAccountId: accountId });
      return;
    }
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
      console.log('dbAccount', dbAccount);
      onPress?.({ token: item, realAccountId: dbAccount.id });
    } catch {
      setLoading(true);
      try {
        await createAddress({
          selectAfterCreate: true,
          num: 0,
          account: {
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: account.indexedAccountId,
            }),
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
  }, [onPress, item, networkId, account, accountId, createAddress]);

  const renderItem = useCallback(
    ({ disableDefaultBehavior }: { disableDefaultBehavior?: boolean }) => {
      return (
        <ListItem
          userSelect="none"
          onPress={disableDefaultBehavior ? () => {} : handlePress}
        >
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
    },
    [handlePress, intl, item, loading, network?.logoURI, network?.name, symbol],
  );

  if (
    vaultSettings?.mergeDeriveAssetsEnabled &&
    !accountUtils.isOthersWallet({ walletId })
  ) {
    return (
      <AddressTypeSelector
        walletId={walletId}
        networkId={item.networkId}
        indexedAccountId={account?.indexedAccountId || ''}
        renderSelectorTrigger={renderItem({ disableDefaultBehavior: true })}
        onSelect={handlePress}
        doubleConfirm
        placement="bottom-start"
        offset={{
          mainAxis: 0,
          crossAxis: 20,
        }}
      />
    );
  }

  return renderItem({});
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
