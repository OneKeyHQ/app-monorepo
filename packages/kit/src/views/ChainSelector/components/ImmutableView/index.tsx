import { type FC, useCallback, useMemo, useState } from 'react';

import { ListView, SearchBar, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IServerNetwork } from '@onekeyhq/shared/types';

type IImmutableViewProps = {
  networks: IServerNetwork[];
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
};

export const ImmutableView: FC<IImmutableViewProps> = ({
  networks,
  networkId,
  onPressItem,
}) => {
  const [text, setText] = useState('');
  const onChangeText = useCallback((value: string) => {
    setText(value.trim());
  }, []);

  const data = useMemo(() => {
    const key = text.toLowerCase();
    return networks.filter(
      (o) =>
        o.name.toLowerCase().includes(key) ||
        o.shortname.toLowerCase().includes(text),
    );
  }, [networks, text]);
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
                src: item.logoURI,
                size: '$8',
              }}
              title={item.name}
              onPress={() => onPressItem?.(item)}
            >
              {networkId === item.id ? (
                <ListItem.CheckMark
                  key="checkmark"
                  enterStyle={{
                    opacity: 0,
                    scale: 0,
                  }}
                />
              ) : null}
            </ListItem>
          )}
        />
      </Stack>
    </Stack>
  );
};
