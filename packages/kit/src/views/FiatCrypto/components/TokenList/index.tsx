import { type FC, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { ListView, SearchBar, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  return (
    <Stack flex={1}>
      <Stack px="$4">
        <SearchBar w="100%" value={text} onChangeText={onChangeText} />
      </Stack>
      <Stack flex={1}>
        <ListView
          estimatedItemSize={48}
          data={data}
          renderItem={({ item }) => (
            <ListItem
              h={48}
              avatarProps={{
                src: item.icon,
                size: '$8',
              }}
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
        />
      </Stack>
    </Stack>
  );
};
