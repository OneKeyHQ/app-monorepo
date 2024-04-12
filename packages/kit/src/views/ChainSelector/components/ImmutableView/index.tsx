import { type FC, useCallback, useMemo, useState } from 'react';

import { Empty, ListView, SearchBar, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import type { IServerNetwork } from '@onekeyhq/shared/types';

type IImmutableViewProps = {
  networks: IServerNetwork[];
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
};

const ListEmptyComponent = () => (
  <Empty icon="SearchOutline" title="No Results" />
);

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
        <SearchBar
          w="100%"
          placeholder="Search"
          value={text}
          onChangeText={onChangeText}
        />
      </Stack>
      <Stack flex={1}>
        <ListView
          ListEmptyComponent={ListEmptyComponent}
          ListHeaderComponent={<Stack h="$2" />}
          ListFooterComponent={<Stack h="$2" />}
          estimatedItemSize={48}
          data={data}
          renderItem={({ item }) => (
            <ListItem
              h={48}
              renderAvatar={<NetworkAvatar networkId={item?.id} size="$8" />}
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
