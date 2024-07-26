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
} from '@onekeyhq/components';
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
    <XStack
      flexDirection="row"
      alignItems="center"
      minHeight="$11"
      space="$3"
      py="$2"
      px="$3"
      mx="$2"
      borderRadius="$3"
      borderCurve="continuous"
      justifyContent="space-between"
      {...{
        hoverStyle: { bg: '$bgHover' },
        pressStyle: { bg: '$bgActive' },
        focusable: true,
        focusStyle: {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: '$focusRing',
          outlineOffset: -2,
        },
      }}
      onPress={() => onPress?.(item)}
    >
      <XStack alignItems="center">
        <Token
          size="lg"
          tokenImageUri={item.icon}
          networkImageUri={network?.logoURI}
        />
        <YStack ml="$3">
          <XStack>
            <SizableText size="$bodyLgMedium">
              {item.symbol.toUpperCase()}
            </SizableText>
            <Stack ml="$2">
              <Badge badgeType="default" badgeSize="sm">
                {network?.name}
              </Badge>
            </Stack>
          </XStack>
          <SizableText size="$bodyMd">{item.name}</SizableText>
        </YStack>
        <YStack />
      </XStack>
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
    </XStack>
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
            <ListItemFiatToken item={item} onPress={onPress} />
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
