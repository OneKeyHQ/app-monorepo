import { Empty, ListView, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import type { IServerNetwork } from '@onekeyhq/shared/types';

const ListEmptyComponent = () => (
  <Empty icon="SearchOutline" title="No Results" />
);

const implArr = ['evm', 'dot', 'cosmos'];

export type IBaseListViewProps = {
  networks: IServerNetwork[];
  onPressItem?: (item: IServerNetwork) => void;
  networkId?: string;
};

export const filterNetwork =
  (key: string, impl?: boolean) =>
  (o: IServerNetwork): boolean => {
    if (impl && implArr.includes(key)) {
      return o.impl === key;
    }
    return (
      o.name.toLowerCase().includes(key) ||
      o.shortname.toLowerCase().includes(key)
    );
  };

export const BaseListView = ({
  networks,
  onPressItem,
  networkId,
}: IBaseListViewProps) => (
  <ListView
    ListEmptyComponent={ListEmptyComponent}
    ListHeaderComponent={<Stack h="$2" />}
    ListFooterComponent={<Stack h="$2" />}
    estimatedItemSize={48}
    data={networks}
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
);
