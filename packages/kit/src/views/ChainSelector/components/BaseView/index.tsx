import { Empty, ListView, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  AllNetworksAvatar,
  NetworkAvatar,
} from '@onekeyhq/kit/src/components/NetworkAvatar';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';

import type { IServerNetworkMatch } from '../../types';

const ListEmptyComponent = () => (
  <Empty icon="SearchOutline" title="No Results" />
);

export type IBaseListViewProps = {
  networks: IServerNetworkMatch[];
  onPressItem?: (item: IServerNetworkMatch) => void;
  networkId?: string;
};

export const BaseListView = ({
  networks,
  onPressItem,
  networkId,
}: IBaseListViewProps) => (
  <ListView
    ListEmptyComponent={ListEmptyComponent}
    ListFooterComponent={<Stack h="$2" />}
    estimatedItemSize={48}
    data={networks}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => (
      <ListItem
        h={48}
        renderAvatar={
          item.id === dangerAllNetworkRepresent.id ? (
            <AllNetworksAvatar size="$8" />
          ) : (
            <NetworkAvatar networkId={item?.id} size="$8" />
          )
        }
        title={item.name}
        titleMatch={item.titleMatch}
        onPress={() => onPressItem?.(item)}
        testID={`select-item-${item.id}`}
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
