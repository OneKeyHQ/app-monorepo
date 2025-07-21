import { useCallback } from 'react';

import { Button, XStack } from '@onekeyhq/components';

import type { ISimpleTabHeaderProps, ITabItem } from './types';

export function SimpleTabHeader<T = string>({
  data,
  activeIndex,
  onTabPress,
  renderTitle,
  containerProps,
  size = 'small',
  gap = '$2',
}: ISimpleTabHeaderProps<T>) {
  const handleTabPress = useCallback(
    (index: number, tabId: T) => {
      onTabPress(index, tabId);
    },
    [onTabPress],
  );

  const renderTabButton = useCallback(
    (item: ITabItem<T>, index: number) => {
      const isActive = index === activeIndex;

      return (
        <Button
          key={item.id as string}
          size={size}
          variant={isActive ? 'primary' : 'secondary'}
          disabled={item.disabled}
          onPress={() => handleTabPress(index, item.id)}
        >
          {renderTitle ? renderTitle(item, index, isActive) : item.title}
        </Button>
      );
    },
    [activeIndex, size, renderTitle, handleTabPress],
  );

  return (
    <XStack
      gap={gap}
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      {...containerProps}
    >
      {data.map(renderTabButton)}
    </XStack>
  );
}
