import { type FC, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  NumberSizeableText,
  SearchBar,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { useGetNetwork } from '../NetworkContainer';

type ITokenListProps = {
  items: IFiatCryptoToken[];
  onPress?: (network: IFiatCryptoToken) => void;
};

const keyExtractor = (item: unknown) => {
  const address = (item as IFiatCryptoToken).address;
  const networkId = (item as IFiatCryptoToken).networkId;
  return `${networkId}--${address || 'main'}`;
};

const ListItemAvatar = ({ item }: { item: IFiatCryptoToken }) => {
  const network = useGetNetwork({ networkId: item.networkId });
  return (
    <Token
      size="lg"
      tokenImageUri={item.icon}
      networkImageUri={network?.logoURI}
    />
  );
};

export const TokenList: FC<ITokenListProps> = ({ items, onPress }) => {
  const [text, setText] = useState('');
  const onChangeText = useCallback((value: string) => {
    setText(value.trim());
  }, []);
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const data = useMemo(() => {
    const key = text.toLowerCase();
    return items.filter(
      (o) =>
        o.name.toLowerCase().includes(key) ||
        o.symbol.toLowerCase().includes(text),
    );
  }, [items, text]);
  const intl = useIntl();
  return (
    <Stack flex={1}>
      <Stack px="$4">
        <SearchBar
          w="100%"
          placeholder={intl.formatMessage({
            id: ETranslations.global_search_tokens,
          })}
          value={text}
          onChangeText={onChangeText}
        />
      </Stack>
      <Stack flex={1}>
        <ListView
          pb="$2"
          estimatedItemSize={60}
          data={data}
          renderItem={({ item }) => (
            <ListItem
              renderAvatar={<ListItemAvatar item={item} />}
              title={item.symbol.toUpperCase()}
              subtitle={item.name}
              onPress={() => onPress?.(item)}
            >
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
            </ListItem>
          )}
          keyExtractor={keyExtractor}
          ListHeaderComponent={<Stack h="$2" />}
          ListFooterComponent={<Stack h="$2" />}
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
