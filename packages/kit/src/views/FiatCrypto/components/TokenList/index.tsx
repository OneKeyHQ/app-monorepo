import { type FC, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Empty, ListView, SearchBar, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

type ITokenListProps = {
  items: IFiatCryptoToken[];
  onPress?: (network: IFiatCryptoToken) => void;
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
          estimatedItemSize={48}
          data={data}
          renderItem={({ item }) => (
            <ListItem
              h={48}
              renderAvatar={<Token size="md" tokenImageUri={item.icon} />}
              title={item.symbol.toUpperCase()}
              subtitle={item.name}
              onPress={() => onPress?.(item)}
            >
              {item.balanceParsed || item.fiatValue ? (
                <ListItem.Text
                  align="right"
                  primary={item.balanceParsed}
                  secondary={
                    item.fiatValue
                      ? `${symbol}${new BigNumber(item.fiatValue).toFixed(2)}`
                      : undefined
                  }
                />
              ) : null}
            </ListItem>
          )}
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
