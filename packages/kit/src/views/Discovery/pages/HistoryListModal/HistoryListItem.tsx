import { useCallback } from 'react';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { DiscoveryIcon } from '../../components/DiscoveryIcon';

import type { IBrowserHistory } from '../../types';

type IHistoryListItemProps = {
  item: IBrowserHistory;
  isEditing?: boolean;
  testIDPrefix?: string;
  onPress?: (item: IBrowserHistory) => void;
  onDelete?: (item: IBrowserHistory) => void;
};

export function HistoryListItem({
  item,
  isEditing,
  testIDPrefix = 'search-modal',
  onPress,
  onDelete,
}: IHistoryListItemProps) {
  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const handleDelete = useCallback(() => {
    onDelete?.(item);
  }, [item, onDelete]);

  return (
    <ListItem
      key={item.id}
      renderAvatar={<DiscoveryIcon uri={item.logo} size="$10" />}
      title={item.title}
      titleProps={{
        numberOfLines: 1,
      }}
      subtitle={item.url}
      subtitleProps={{
        numberOfLines: 1,
      }}
      testID={`${testIDPrefix}-${item.url.toLowerCase()}`}
      {...(!isEditing && onPress
        ? {
            onPress: handlePress,
          }
        : undefined)}
    >
      {isEditing && onDelete ? (
        <ListItem.IconButton icon="DeleteOutline" onPress={handleDelete} />
      ) : null}
    </ListItem>
  );
}
