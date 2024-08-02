import { type FC, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  ListView,
  NumberSizeableText,
  SearchBar,
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { ListItem } from '../../../../components/ListItem';
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

const ListItemFiatToken = ({
  item,
  onPress,
}: {
  item: IFiatCryptoToken;
  onPress?: (item: IFiatCryptoToken) => void;
}) => {
  const network = useGetNetwork({ networkId: item.networkId });
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  return (
    <ListItem userSelect="none" onPress={() => onPress?.(item)}>
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
